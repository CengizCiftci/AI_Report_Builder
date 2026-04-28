const express = require("express");
const { z } = require("zod");
const { authenticate } = require("../middleware/auth");
const { query } = require("../db");
const { getDictionary } = require("../services/dictionary-service");
const { generateReportPlan } = require("../services/planner-service");
const { applyScopeToPlan } = require("../services/scope-service");
const { ReportPlanSchema } = require("../utils/report-plan-schema");
const { buildSql } = require("../services/sql-builder");

const router = express.Router();

async function saveQueryLog(logInput) {
  try {
    await query(
      `
        INSERT INTO report_query_logs (
          user_id,
          status,
          is_dry_run,
          row_count,
          execution_ms,
          error_message,
          sql_text,
          params_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        logInput.userId ?? null,
        logInput.status ?? "error",
        Boolean(logInput.isDryRun),
        logInput.rowCount ?? null,
        logInput.executionMs ?? null,
        logInput.errorMessage ?? null,
        logInput.sqlText ?? null,
        JSON.stringify(logInput.paramsJson ?? [])
      ]
    );
  } catch (error) {
    console.warn("report_query_logs save skipped:", error.message);
  }
}

router.get("/history", authenticate, async (req, res, next) => {
  try {
    const queryParams = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0)
      })
      .parse(req.query);

    const [historyResult, countResult] = await Promise.all([
      query(
        `
          SELECT
            id,
            prompt,
            raw_plan AS "rawPlan",
            scoped_plan AS "scopedPlan",
            status,
            confidence,
            planner_source AS "plannerSource",
            validation_errors AS "validationErrors",
            audit_log AS "auditLog",
            created_at AS "createdAt"
          FROM report_plans
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
          OFFSET $3
        `,
        [req.user.sub, queryParams.limit, queryParams.offset]
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM report_plans
          WHERE user_id = $1
        `,
        [req.user.sub]
      )
    ]);

    const total = countResult.rows[0]?.total || 0;
    const items = historyResult.rows;

    return res.json({
      items,
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset,
        total,
        hasMore: queryParams.offset + items.length < total
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/plan", authenticate, async (req, res, next) => {
  try {
    const body = z
      .object({
        prompt: z.string().min(5)
      })
      .parse(req.body);

    const dictionary = await getDictionary();
    const plannerResult = await generateReportPlan({
      prompt: body.prompt,
      dictionary,
      user: req.user
    });
    const draftPlan = plannerResult.plan;
    const metadata = plannerResult.metadata || {};

    const scopedPlan = applyScopeToPlan(draftPlan, req.user);
    const scopeAuditEvent = {
      at: new Date().toISOString(),
      step: "scope_applied",
      status: "ok",
      details: {
        originalFilterCount: draftPlan.filters?.length || 0,
        scopedFilterCount: scopedPlan.filters?.length || 0
      }
    };
    const auditLog = [...(metadata.auditLog || []), scopeAuditEvent];
    const validationErrors = metadata.validationErrors || [];
    const confidence = metadata.confidence ?? draftPlan.confidence ?? null;
    const plannerSource = metadata.source || "unknown";
    const status = validationErrors.some((v) => v.severity === "error")
      ? "needs_review"
      : "generated";

    try {
      await query(
        `
        INSERT INTO report_plans (
          user_id,
          prompt,
          raw_plan,
          scoped_plan,
          status,
          confidence,
          validation_errors,
          audit_log,
          planner_source
        )
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9)
        `,
        [
          req.user.sub,
          body.prompt,
          JSON.stringify(draftPlan),
          JSON.stringify(scopedPlan),
          status,
          confidence,
          JSON.stringify(validationErrors),
          JSON.stringify(auditLog),
          plannerSource
        ]
      );
    } catch (error) {
      console.warn("report_plans save skipped:", error.message);
    }

    return res.json({
      plan: draftPlan,
      scopedPlan,
      confidence,
      validationErrors,
      auditLog,
      plannerSource,
      status
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/execute", authenticate, async (req, res, next) => {
  const startedAt = Date.now();
  let sqlText = null;
  let paramsJson = [];
  let rowCount = null;
  let isDryRun = false;
  let status = "error";
  let errorMessage = null;

  try {
    const body = z
      .object({
        plan: z.any(),
        dryRun: z.boolean().default(false)
      })
      .parse(req.body);

    isDryRun = body.dryRun;

    const validatedPlan = ReportPlanSchema.parse(body.plan);
    const scopedPlan = applyScopeToPlan(validatedPlan, req.user);
    const { sql, params } = buildSql(scopedPlan);
    sqlText = sql;
    paramsJson = params;

    if (body.dryRun) {
      status = "dry_run";
      rowCount = 0;
      await saveQueryLog({
        userId: req.user.sub,
        status,
        isDryRun,
        rowCount,
        executionMs: Date.now() - startedAt,
        errorMessage,
        sqlText,
        paramsJson
      });
      return res.json({ sql, params, rows: [] });
    }

    const result = await query(sql, params);
    status = "success";
    rowCount = result.rowCount ?? 0;
    await saveQueryLog({
      userId: req.user.sub,
      status,
      isDryRun,
      rowCount,
      executionMs: Date.now() - startedAt,
      errorMessage,
      sqlText,
      paramsJson
    });

    return res.json({
      sql,
      params,
      rowCount: result.rowCount,
      rows: result.rows
    });
  } catch (error) {
    errorMessage = error.message;
    await saveQueryLog({
      userId: req.user?.sub,
      status,
      isDryRun,
      rowCount,
      executionMs: Date.now() - startedAt,
      errorMessage,
      sqlText,
      paramsJson
    });
    return next(error);
  }
});

module.exports = { reportRouter: router };
