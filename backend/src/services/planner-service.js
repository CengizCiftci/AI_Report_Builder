const { env } = require("../config/env");
const { normalizePlan } = require("../utils/normalize-plan");
const {
  ReportPlanSchema,
  REPORT_PLAN_JSON_SCHEMA
} = require("../utils/report-plan-schema");

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

async function callOpenAIPlanner({ prompt, dictionary, user }) {
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

  // console.log("User:", JSON.stringify(user, null, 2));
  // console.log(' << -------------------------------------------------------------------- >>');
  // console.log("Prompt:", prompt);
  // console.log(' << -------------------------------------------------------------------- >>');
  // console.log("Dictionary:", JSON.stringify(dictionary, null, 2));

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
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  if (!text) {
    throw new Error("OpenAI returned empty response");
  }


  const raw = JSON.parse(text);
  const normalized = normalizePlan(raw);
  const parsed = ReportPlanSchema.parse(normalized);

  // const parsed = JSON.parse(text);
  return ReportPlanSchema.parse(parsed);
}

async function generateReportPlan({ prompt, dictionary, user }) {
  //TODO: Remove this hardcoded fallback after completing development in frontend.
  // return ReportPlanSchema.parse(buildFallbackPlan(prompt));
  if (!env.OPENAI_API_KEY) {
    return ReportPlanSchema.parse(buildFallbackPlan(prompt));
  }

  try {
    return await callOpenAIPlanner({ prompt, dictionary, user });
  } catch (error) {
    console.error("Planner fallback due to OpenAI issue:", error.message);
    return ReportPlanSchema.parse(buildFallbackPlan(prompt));
  }
}

module.exports = {
  generateReportPlan
};
