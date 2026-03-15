const { z } = require("zod");

const NullableIdSchema = z.union([z.number().int(), z.string()]).nullable();

const ReportFilterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum([
      "=",
      "!=",
      "IN",
      "NOT IN",
      ">",
      ">=",
      "<",
      "<=",
      "BETWEEN",
      "ILIKE"
    ]),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number(), z.boolean()])),
      z.null()
    ])
  })
  .strict();

const ReportMetricSchema = z
  .object({
    name: z.string().min(1),
    aggregation: z
      .enum(["COUNT", "SUM", "AVG", "MIN", "MAX", "RATIO", "CUSTOM"])
      .nullable(),
    field: z.string().nullable(),
    numerator: z.string().nullable(),
    denominator: z.string().nullable(),
    expression: z.string().nullable()
  })
  .strict();

const EntityContextSchema = z
  .object({
    school_id: NullableIdSchema,
    grade_level: NullableIdSchema,
    course_id: NullableIdSchema,
    teacher_id: NullableIdSchema,
    marking_period: z.string().nullable(),
    date_range_start: z.string().nullable(),
    date_range_end: z.string().nullable(),
    subgroup: z.string().nullable()
  })
  .strict();

const ReportPlanSchema = z
  .object({
    intent: z.string().min(1),
    granularity: z.enum(["student", "class", "grade", "school"]),
    entities: EntityContextSchema,
    columns: z.array(z.string().min(1)).min(1),
    metrics: z.array(ReportMetricSchema),
    filters: z.array(ReportFilterSchema),
    sort: z.array(
      z
        .object({
          field: z.string().min(1),
          direction: z.enum(["ASC", "DESC"])
        })
        .strict()
    ),
    limit: z.number().int().positive().max(1000),
    clarificationQuestion: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable()
  })
  .strict();

module.exports = {
  ReportPlanSchema,
  REPORT_PLAN_JSON_SCHEMA: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string" },
      granularity: {
        type: "string",
        enum: ["student", "class", "grade", "school"]
      },
      entities: {
        type: "object",
        additionalProperties: false,
        properties: {
          school_id: {
            anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }]
          },
          grade_level: {
            anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }]
          },
          course_id: {
            anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }]
          },
          teacher_id: {
            anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }]
          },
          marking_period: {
            anyOf: [{ type: "string" }, { type: "null" }]
          },
          date_range_start: {
            anyOf: [{ type: "string" }, { type: "null" }]
          },
          date_range_end: {
            anyOf: [{ type: "string" }, { type: "null" }]
          },
          subgroup: {
            anyOf: [{ type: "string" }, { type: "null" }]
          }
        },
        required: [
          "school_id",
          "grade_level",
          "course_id",
          "teacher_id",
          "marking_period",
          "date_range_start",
          "date_range_end",
          "subgroup"
        ]
      },
      columns: {
        type: "array",
        minItems: 1,
        items: { type: "string" }
      },
      metrics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            aggregation: {
              anyOf: [
                {
                  type: "string",
                  enum: ["COUNT", "SUM", "AVG", "MIN", "MAX", "RATIO", "CUSTOM"]
                },
                { type: "null" }
              ]
            },
            field: {
              anyOf: [{ type: "string" }, { type: "null" }]
            },
            numerator: {
              anyOf: [{ type: "string" }, { type: "null" }]
            },
            denominator: {
              anyOf: [{ type: "string" }, { type: "null" }]
            },
            expression: {
              anyOf: [{ type: "string" }, { type: "null" }]
            }
          },
          required: [
            "name",
            "aggregation",
            "field",
            "numerator",
            "denominator",
            "expression"
          ]
        }
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            operator: {
              type: "string",
              enum: [
                "=",
                "!=",
                "IN",
                "NOT IN",
                ">",
                ">=",
                "<",
                "<=",
                "BETWEEN",
                "ILIKE"
              ]
            },
            value: {
              anyOf: [
                { type: "string" },
                { type: "integer" },
                { type: "number" },
                { type: "boolean" },
                {
                  type: "array",
                  items: {
                    anyOf: [
                      { type: "string" },
                      { type: "integer" },
                      { type: "number" },
                      { type: "boolean" }
                    ]
                  }
                },
                { type: "null" }
              ]
            }
          },
          required: ["field", "operator", "value"]
        }
      },
      sort: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            direction: {
              type: "string",
              enum: ["ASC", "DESC"]
            }
          },
          required: ["field", "direction"]
        }
      },
      limit: { type: "integer", minimum: 1, maximum: 1000 },
      clarificationQuestion: {
        anyOf: [{ type: "string" }, { type: "null" }]
      },
      confidence: {
        anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }]
      }
    },
    required: [
      "intent",
      "granularity",
      "entities",
      "columns",
      "metrics",
      "filters",
      "sort",
      "limit",
      "clarificationQuestion",
      "confidence"
    ]
  }
};