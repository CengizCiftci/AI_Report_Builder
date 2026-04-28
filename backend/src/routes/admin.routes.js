const express = require("express");
const { z } = require("zod");
const { authenticate } = require("../middleware/auth");
const { query } = require("../db");
const { getDictionary } = require("../services/dictionary-service");
const { HttpError } = require("../utils/http-error");

const router = express.Router();

function isAdmin(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.includes("SUPER_ADMIN") || roles.includes("SCHOOL_ADMIN");
}

function ensureAdmin(req) {
  if (!isAdmin(req.user)) {
    throw new HttpError(403, "Admin access required.");
  }
}

router.use(authenticate);

router.get("/dictionary", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const dictionary = await getDictionary();
    return res.json(dictionary);
  } catch (error) {
    return next(error);
  }
});

router.post("/dictionary/entities", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const body = z
      .object({
        key: z.string().min(1),
        label: z.string().min(1),
        description: z.string().nullable().optional()
      })
      .parse(req.body);

    const result = await query(
      `
        INSERT INTO entity_definitions (key, label, description)
        VALUES ($1, $2, $3)
        RETURNING id, key, label, description
      `,
      [body.key.trim(), body.label.trim(), body.description ?? null]
    );

    return res.status(201).json({ entity: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/dictionary/synonyms", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const body = z
      .object({
        entityKey: z.string().min(1),
        synonymText: z.string().min(1)
      })
      .parse(req.body);

    const entity = await query(
      `SELECT id, key FROM entity_definitions WHERE key = $1 LIMIT 1`,
      [body.entityKey.trim()]
    );

    if (!entity.rows[0]) {
      throw new HttpError(404, `Entity not found: ${body.entityKey}`);
    }

    const insert = await query(
      `
        INSERT INTO entity_synonyms (entity_id, synonym_text)
        VALUES ($1, $2)
        RETURNING id, synonym_text
      `,
      [entity.rows[0].id, body.synonymText.trim()]
    );

    return res.status(201).json({
      synonym: {
        id: insert.rows[0].id,
        entity_key: entity.rows[0].key,
        synonym_text: insert.rows[0].synonym_text
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/dictionary/metrics", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const body = z
      .object({
        key: z.string().min(1),
        label: z.string().min(1),
        formulaType: z.string().min(1),
        numeratorField: z.string().nullable().optional(),
        denominatorField: z.string().nullable().optional(),
        aggregationDefault: z.string().min(1)
      })
      .parse(req.body);

    const insert = await query(
      `
        INSERT INTO metric_definitions (
          key,
          label,
          formula_type,
          numerator_field,
          denominator_field,
          aggregation_default
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING key, label, formula_type, numerator_field, denominator_field, aggregation_default
      `,
      [
        body.key.trim(),
        body.label.trim(),
        body.formulaType.trim(),
        body.numeratorField ?? null,
        body.denominatorField ?? null,
        body.aggregationDefault.trim()
      ]
    );

    return res.status(201).json({ metric: insert.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/dictionary/relationships", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const body = z
      .object({
        fromEntity: z.string().min(1),
        toEntity: z.string().min(1),
        joinPath: z.string().min(1),
        cardinality: z.string().min(1)
      })
      .parse(req.body);

    const insert = await query(
      `
        INSERT INTO relationship_definitions (from_entity, to_entity, join_path, cardinality)
        VALUES ($1, $2, $3, $4)
        RETURNING from_entity, to_entity, join_path, cardinality
      `,
      [
        body.fromEntity.trim(),
        body.toEntity.trim(),
        body.joinPath.trim(),
        body.cardinality.trim()
      ]
    );

    return res.status(201).json({ relationship: insert.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/dictionary/fields", async (req, res, next) => {
  try {
    ensureAdmin(req);
    const body = z
      .object({
        fieldKey: z.string().min(1),
        entityKey: z.string().min(1),
        dataType: z.string().min(1),
        isGroupable: z.boolean().default(true),
        isFilterable: z.boolean().default(true),
        isAggregatable: z.boolean().default(false)
      })
      .parse(req.body);

    const insert = await query(
      `
        INSERT INTO field_definitions (
          field_key,
          entity_key,
          data_type,
          is_groupable,
          is_filterable,
          is_aggregatable
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING field_key, entity_key, data_type, is_groupable, is_filterable, is_aggregatable
      `,
      [
        body.fieldKey.trim(),
        body.entityKey.trim(),
        body.dataType.trim(),
        body.isGroupable,
        body.isFilterable,
        body.isAggregatable
      ]
    );

    return res.status(201).json({ field: insert.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/analytics/summary", async (req, res, next) => {
  try {
    ensureAdmin(req);

    const summaryResult = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM report_plans) AS total_report_plans,
        (SELECT COUNT(*)::int FROM report_plans WHERE status = 'generated') AS generated_report_plans,
        (SELECT COUNT(*)::int FROM report_plans WHERE status = 'needs_review') AS needs_review_report_plans,
        (SELECT COALESCE(AVG(confidence), 0)::numeric FROM report_plans WHERE confidence IS NOT NULL) AS avg_plan_confidence,
        (SELECT COUNT(*)::int FROM report_plans WHERE created_at >= NOW() - INTERVAL '7 days') AS plans_last_7_days,
        (SELECT COUNT(*)::int FROM report_query_logs) AS total_query_runs,
        (SELECT COUNT(*)::int FROM report_query_logs WHERE status = 'success') AS successful_query_runs,
        (SELECT COUNT(*)::int FROM report_query_logs WHERE status = 'error') AS failed_query_runs,
        (SELECT COUNT(*)::int FROM report_query_logs WHERE status = 'dry_run') AS dry_run_query_runs,
        (SELECT COALESCE(AVG(execution_ms), 0)::numeric FROM report_query_logs WHERE execution_ms IS NOT NULL) AS avg_execution_ms
    `);

    const activityPlans = await query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM report_plans
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY 1
        ORDER BY 1 ASC
      `
    );

    const activityQueries = await query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM report_query_logs
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY 1
        ORDER BY 1 ASC
      `
    );

    const summary = summaryResult.rows[0] || {};
    const successBase =
      (summary.successful_query_runs || 0) + (summary.failed_query_runs || 0);
    const querySuccessRate =
      successBase > 0
        ? Number(((summary.successful_query_runs / successBase) * 100).toFixed(2))
        : 0;

    return res.json({
      summary: {
        ...summary,
        query_success_rate: querySuccessRate
      },
      activity: {
        plans_per_day: activityPlans.rows,
        query_runs_per_day: activityQueries.rows
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/query-logs", async (req, res, next) => {
  try {
    ensureAdmin(req);

    const paramsSchema = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(["success", "error", "dry_run"]).optional()
      })
      .parse(req.query);

    const values = [];
    const whereParts = [];

    if (paramsSchema.status) {
      values.push(paramsSchema.status);
      whereParts.push(`l.status = $${values.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    values.push(paramsSchema.limit);
    const limitIndex = values.length;
    values.push(paramsSchema.offset);
    const offsetIndex = values.length;

    const logsSql = `
      SELECT
        l.id,
        l.user_id AS "userId",
        u.username,
        l.status,
        l.is_dry_run AS "isDryRun",
        l.row_count AS "rowCount",
        l.execution_ms AS "executionMs",
        l.error_message AS "errorMessage",
        l.sql_text AS "sqlText",
        l.params_json AS "paramsJson",
        l.created_at AS "createdAt"
      FROM report_query_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `;

    const countValues = values.slice(0, whereParts.length);
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM report_query_logs l
      ${whereClause}
    `;

    const [logsResult, countResult] = await Promise.all([
      query(logsSql, values),
      query(countSql, countValues)
    ]);

    const total = countResult.rows[0]?.total || 0;

    return res.json({
      items: logsResult.rows,
      pagination: {
        limit: paramsSchema.limit,
        offset: paramsSchema.offset,
        total,
        hasMore: paramsSchema.offset + logsResult.rows.length < total
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = { adminRouter: router };
