const { env } = require("../config/env");
const { normalizePlan } = require("../utils/normalize-plan");
const {
  ReportPlanSchema,
  REPORT_PLAN_JSON_SCHEMA
} = require("../utils/report-plan-schema");

function addAuditLog(auditLog, step, status, details = {}) {
  auditLog.push({
    at: new Date().toISOString(),
    step,
    status,
    details
  });
}

function normalizeAndParsePlan(rawPlan) {
  const normalized = normalizePlan(rawPlan);
  return ReportPlanSchema.parse(normalized);
}

function toDictionarySets(dictionary) {
  const fieldKeys = new Set((dictionary?.fields || []).map((f) => f.field_key));
  const metricKeys = new Set((dictionary?.metrics || []).map((m) => m.key));
  return { fieldKeys, metricKeys };
}

function collectValidationErrors(plan, dictionary) {
  const { fieldKeys, metricKeys } = toDictionarySets(dictionary);
  const issues = [];

  for (const column of plan.columns || []) {
    if (!fieldKeys.has(column)) {
      issues.push({
        code: "UNKNOWN_COLUMN",
        severity: "error",
        field: "columns",
        value: column,
        message: `Column "${column}" is not in dictionary field whitelist.`
      });
    }
  }

  for (const filter of plan.filters || []) {
    if (!fieldKeys.has(filter.field)) {
      issues.push({
        code: "UNKNOWN_FILTER_FIELD",
        severity: "error",
        field: "filters",
        value: filter.field,
        message: `Filter field "${filter.field}" is not in dictionary field whitelist.`
      });
    }

    if (filter.operator === "BETWEEN") {
      const values = Array.isArray(filter.value) ? filter.value : [];
      const isIsoDate =
        values.length === 2 &&
        values.every(
          (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        );

      if (values.length === 2 && !isIsoDate) {
        issues.push({
          code: "NON_ISO_DATE_RANGE",
          severity: "warning",
          field: "filters",
          value: filter.value,
          message: "BETWEEN date range should use ISO format (YYYY-MM-DD)."
        });
      }
    }
  }

  for (const metric of plan.metrics || []) {
    if (metricKeys.has(metric.name)) continue;

    if (!metric.aggregation || !metric.field) {
      issues.push({
        code: "UNKNOWN_METRIC_DEFINITION",
        severity: "error",
        field: "metrics",
        value: metric.name,
        message: `Metric "${metric.name}" is unknown and missing aggregation/field mapping.`
      });
      continue;
    }

    if (!fieldKeys.has(metric.field)) {
      issues.push({
        code: "UNKNOWN_METRIC_FIELD",
        severity: "error",
        field: "metrics",
        value: metric.field,
        message: `Metric field "${metric.field}" is not in dictionary field whitelist.`
      });
    }
  }

  const sortableAliases = new Set([
    ...(plan.columns || []),
    ...((plan.metrics || []).map((metric) => metric.name))
  ]);

  for (const sort of plan.sort || []) {
    if (!sortableAliases.has(sort.field)) {
      issues.push({
        code: "UNKNOWN_SORT_FIELD",
        severity: "warning",
        field: "sort",
        value: sort.field,
        message: `Sort field "${sort.field}" is not present in selected columns/metrics.`
      });
    }
  }

  return issues;
}

function computeConfidence(plan, validationErrors, source) {
  const modelConfidence =
    typeof plan.confidence === "number" &&
    !Number.isNaN(plan.confidence) &&
    plan.confidence >= 0 &&
    plan.confidence <= 1
      ? plan.confidence
      : null;

  let score = modelConfidence ?? (source === "fallback" ? 0.5 : 0.72);

  if (plan.clarificationQuestion) score -= 0.2;

  const errorCount = validationErrors.filter((issue) => issue.severity === "error").length;
  const warningCount = validationErrors.filter((issue) => issue.severity === "warning").length;

  score -= errorCount * 0.18;
  score -= warningCount * 0.07;

  if ((plan.metrics || []).length === 0) score -= 0.08;
  if ((plan.columns || []).length < 2) score -= 0.05;
  if ((plan.filters || []).length === 0) score -= 0.03;

  const bounded = Math.min(0.99, Math.max(0.05, score));
  return Number(bounded.toFixed(2));
}

function buildSystemPrompt(dictionary, user) {
  return [
    "You are a report planner that converts natural language requests into a strict REPORT Plan JSON.",
    "Do not generate SQL.",
    "Use only fields and metrics from the provided dictionary when possible.",
    "If request is ambiguous, add clarificationQuestion.",
    "Respect user scope by keeping requested entities/filters compatible.",
    "Output only valid JSON matching the schema.",
    "Request exact dates when user asks for date ranges without specifying them, don't accept informal date descriptions like 'today' or 'yesterday', or `last month`.",
    "--- DICTIONARY ---",
    JSON.stringify(dictionary),
    "--- USER CONTEXT ---",
    JSON.stringify({ roles: user.roles, scopes: user.scopes })
  ].join("\n");
}

function detectGranularity(input) {
  const text = input.toLowerCase();
  if (text.includes("öğrenci") || text.includes("student")) return "student";
  if (text.includes("sınıf") || text.includes("class") || text.includes("section")) {
    return "class";
  }
  if (text.includes("grade") || text.includes("sınıf seviyesi") || text.includes("kademe")) {
    return "grade";
  }
  return "school";
}

function buildFallbackPlan(prompt) {
  const lower = prompt.toLowerCase();
  const isAttendance =
    lower.includes("attendance") ||
    lower.includes("devam") ||
    lower.includes("devamsız");

  const dates = prompt.match(/\d{4}-\d{2}-\d{2}/g) || [];

  const basePlan = {
    intent: isAttendance ? "attendance_summary" : "general_summary",
    granularity: detectGranularity(prompt),
    entities: {},
    columns: ["school_name", "grade_level"],
    metrics: [{ name: "student_count", aggregation: "COUNT", field: "student_id" }],
    filters: [],
    sort: [{ field: "student_count", direction: "DESC" }],
    limit: 100,
    clarificationQuestion: null,
    confidence: 0.45
  };

  if (isAttendance) {
    basePlan.metrics.push({ name: "attendance_rate", aggregation: "RATIO" });
    basePlan.columns.push("course_name");
  }

  if (dates.length >= 2) {
    basePlan.filters.push({
      field: "attendance_date",
      operator: "BETWEEN",
      value: [dates[0], dates[1]]
    });
  }

  return basePlan;
}

function extractResponseText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  const chunks = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAIPlanner({ prompt, dictionary, user, auditLog }) {
  addAuditLog(auditLog, "openai_request_started", "ok", {
    model: env.OPENAI_MODEL
  });

  const body = {
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildSystemPrompt(dictionary, user) }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "report_plan",
        strict: true,
        schema: REPORT_PLAN_JSON_SCHEMA
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    addAuditLog(auditLog, "openai_request_failed", "error", {
      status: response.status,
      error: errorText
    });
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  if (!text) {
    addAuditLog(auditLog, "openai_empty_output", "error");
    throw new Error("OpenAI returned empty response");
  }

  addAuditLog(auditLog, "openai_response_received", "ok", {
    outputLength: text.length
  });

  const raw = JSON.parse(text);
  addAuditLog(auditLog, "openai_json_parsed", "ok");

  const parsed = normalizeAndParsePlan(raw);
  addAuditLog(auditLog, "schema_validation_passed", "ok");

  return parsed;
}

async function generateReportPlan({ prompt, dictionary, user }) {
  const auditLog = [];
  addAuditLog(auditLog, "request_received", "ok", {
    promptLength: prompt.length
  });

  let plan;
  let source = "openai";

  try {
    if (!env.OPENAI_API_KEY) {
      source = "fallback";
      addAuditLog(auditLog, "fallback_used", "warning", {
        reason: "OPENAI_API_KEY_NOT_SET"
      });
      plan = normalizeAndParsePlan(buildFallbackPlan(prompt));
    } else {
      plan = await callOpenAIPlanner({ prompt, dictionary, user, auditLog });
    }
  } catch (error) {
    source = "fallback";
    console.error("Planner fallback due to OpenAI issue:", error.message);
    addAuditLog(auditLog, "fallback_used", "warning", {
      reason: "OPENAI_CALL_FAILED",
      error: error.message
    });
    plan = normalizeAndParsePlan(buildFallbackPlan(prompt));
  }

  const validationErrors = collectValidationErrors(plan, dictionary);
  addAuditLog(auditLog, "plan_semantic_validation", "ok", {
    total: validationErrors.length,
    errors: validationErrors.filter((issue) => issue.severity === "error").length,
    warnings: validationErrors.filter((issue) => issue.severity === "warning").length
  });

  const confidence = computeConfidence(plan, validationErrors, source);
  const finalizedPlan = {
    ...plan,
    confidence
  };

  addAuditLog(auditLog, "confidence_computed", "ok", {
    confidence,
    source
  });

  return {
    plan: finalizedPlan,
    metadata: {
      confidence,
      validationErrors,
      auditLog,
      source
    }
  };
}

module.exports = {
  generateReportPlan
};
