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
  try {
    const body =   z
      .object({
        plan: z.any(),
        dryRun: z.boolean().default(false)
      })
      .parse(req.body);

    const validatedPlan = ReportPlanSchema.parse(body.plan);
    const scopedPlan = applyScopeToPlan(validatedPlan, req.user);
    const { sql, params } = buildSql(scopedPlan);

    if (body.dryRun) {
      return res.json({ sql, params, rows: [] });
    }

    const result = await query(sql, params);
    return res.json({
      sql,
      params,
      rowCount: result.rowCount,
      rows: result.rows
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = { reportRouter: router };
