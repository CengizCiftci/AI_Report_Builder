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
    const draftPlan = await generateReportPlan({
      prompt: body.prompt,
      dictionary,
      user: req.user
    });

    const scopedPlan = applyScopeToPlan(draftPlan, req.user);

    try {
      await query(
        `
        INSERT INTO report_plans (user_id, prompt, raw_plan, scoped_plan, status)
        VALUES ($1, $2, $3::jsonb, $4::jsonb, 'generated')
        `,
        [req.user.sub, body.prompt, JSON.stringify(draftPlan), JSON.stringify(scopedPlan)]
      );
    } catch (error) {
      console.warn("report_plans save skipped:", error.message);
    }

    return res.json({
      plan: draftPlan,
      scopedPlan
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
