function normalizePlan(plan = {}) {
  const toNull = (v) => {
    if (v === undefined || v === "") return null;
    return v;
  };

  const normalizeId = (v) => {
    if (v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isNaN(v) ? null : v;
    if (typeof v === "string") {
      const s = v.trim();
      return s === "" ? null : s;
    }
    return null;
  };

  const normalizeString = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s === "" ? null : s;
  };

  const normalizeMetric = (m = {}) => ({
    name: typeof m.name === "string" ? m.name.trim() : "",
    aggregation: normalizeString(m.aggregation),
    field: normalizeString(m.field),
    numerator: normalizeString(m.numerator),
    denominator: normalizeString(m.denominator),
    expression: normalizeString(m.expression)
  });

  const normalizeFilterValue = (v) => {
    if (v === undefined) return null;
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      return v;
    }
    if (Array.isArray(v)) {
      return v.map((x) => {
        if (
          x === null ||
          typeof x === "string" ||
          typeof x === "number" ||
          typeof x === "boolean"
        ) {
          return x;
        }
        return String(x);
      });
    }
    return String(v);
  };

  const normalizeFilter = (f = {}) => ({
    field: typeof f.field === "string" ? f.field.trim() : "",
    operator: typeof f.operator === "string" ? f.operator.trim() : "=",
    value: normalizeFilterValue(f.value)
  });

  const normalizeSort = (s = {}) => ({
    field: typeof s.field === "string" ? s.field.trim() : "",
    direction: s.direction === "DESC" ? "DESC" : "ASC"
  });

  const limit =
    Number.isInteger(plan.limit) && plan.limit > 0 && plan.limit <= 1000
      ? plan.limit
      : 200;

  const confidence =
    typeof plan.confidence === "number" &&
    !Number.isNaN(plan.confidence) &&
    plan.confidence >= 0 &&
    plan.confidence <= 1
      ? plan.confidence
      : null;

  return {
    intent: typeof plan.intent === "string" ? plan.intent.trim() : "",
    granularity:
      typeof plan.granularity === "string" ? plan.granularity.trim() : "",
    entities: {
      school_id: normalizeId(plan.entities?.school_id),
      grade_level: normalizeId(plan.entities?.grade_level),
      course_id: normalizeId(plan.entities?.course_id),
      teacher_id: normalizeId(plan.entities?.teacher_id),
      marking_period: normalizeString(plan.entities?.marking_period),
      date_range_start: normalizeString(plan.entities?.date_range_start),
      date_range_end: normalizeString(plan.entities?.date_range_end),
      subgroup: normalizeString(plan.entities?.subgroup)
    },
    columns: Array.isArray(plan.columns)
      ? plan.columns
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter(Boolean)
      : [],
    metrics: Array.isArray(plan.metrics)
      ? plan.metrics.map(normalizeMetric)
      : [],
    filters: Array.isArray(plan.filters)
      ? plan.filters.map(normalizeFilter)
      : [],
    sort: Array.isArray(plan.sort)
      ? plan.sort.map(normalizeSort)
      : [],
    limit,
    clarificationQuestion: normalizeString(plan.clarificationQuestion),
    confidence
  };
}

module.exports = {
  normalizePlan
};