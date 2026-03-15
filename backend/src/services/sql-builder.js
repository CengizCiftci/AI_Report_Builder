const { HttpError } = require("../utils/http-error");

const COLUMN_SQL = {
  school_id: "sch.id",
  school_name: "sch.name",
  grade_level: "st.grade_level",
  course_id: "c.id",
  course_name: "c.name",
  class_id: "sec.id",
  class_name: "sec.name",
  teacher_id: "t.id",
  teacher_name: "t.full_name",
  student_id: "st.id",
  student_name: "st.full_name",
  attendance_date: "a.attendance_date"
};

const METRIC_SQL = {
  student_count: "COUNT(DISTINCT st.id)",
  attendance_days: "SUM(a.present_days)",
  total_days: "SUM(a.total_days)",
  attendance_rate:
    "CASE WHEN SUM(a.total_days) = 0 THEN 0 ELSE ROUND((SUM(a.present_days)::numeric / SUM(a.total_days)::numeric) * 100, 2) END",
  record_count: "COUNT(*)"
};

const FILTERABLE_FIELDS = new Set(Object.keys(COLUMN_SQL));

function toExpression(field) {
  const expression = COLUMN_SQL[field];
  if (!expression) {
    throw new HttpError(400, `Unsupported field: ${field}`);
  }
  return expression;
}

function buildMetricExpression(metric) {
  if (METRIC_SQL[metric.name]) {
    return `${METRIC_SQL[metric.name]} AS ${metric.name}`;
  }

  if (!metric.aggregation || !metric.field) {
    throw new HttpError(400, `Unsupported metric: ${metric.name}`);
  }

  const fieldExpr = toExpression(metric.field);
  const allowedAgg = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

  if (!allowedAgg.has(metric.aggregation)) {
    throw new HttpError(400, `Unsupported aggregation: ${metric.aggregation}`);
  }

  if (metric.aggregation === "COUNT") {
    return `COUNT(DISTINCT ${fieldExpr}) AS ${metric.name}`;
  }

  return `${metric.aggregation}(${fieldExpr}) AS ${metric.name}`;
}

function appendFilterSql(filter, params, whereParts) {
  const fieldExpr = toExpression(filter.field);

  if (!FILTERABLE_FIELDS.has(filter.field)) {
    throw new HttpError(400, `Field is not filterable: ${filter.field}`);
  }

  switch (filter.operator) {
    case "=":
    case "!=":
    case ">":
    case ">=":
    case "<":
    case "<=": {
      params.push(filter.value);
      whereParts.push(`${fieldExpr} ${filter.operator} $${params.length}`);
      return;
    }

    case "ILIKE": {
      params.push(`%${String(filter.value)}%`);
      whereParts.push(`${fieldExpr} ILIKE $${params.length}`);
      return;
    }

    case "IN":
    case "NOT IN": {
      if (!Array.isArray(filter.value) || !filter.value.length) {
        throw new HttpError(400, `${filter.operator} expects a non-empty array`);
      }
      params.push(filter.value);
      const op = filter.operator === "IN" ? "= ANY" : "!= ALL";
      whereParts.push(`${fieldExpr} ${op} ($${params.length})`);
      return;
    }

    case "BETWEEN": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) {
        throw new HttpError(400, "BETWEEN expects [start, end]");
      }
      params.push(filter.value[0]);
      params.push(filter.value[1]);
      whereParts.push(`${fieldExpr} BETWEEN $${params.length - 1} AND $${params.length}`);
      return;
    }

    default:
      throw new HttpError(400, `Unsupported operator: ${filter.operator}`);
  }
}

function buildSql(plan) {
  const dimensions = plan.columns.map((field) => ({
    field,
    expression: toExpression(field)
  }));

  const metrics = (plan.metrics || []).map((metric) => buildMetricExpression(metric));
  if (!metrics.length) {
    metrics.push(`${METRIC_SQL.record_count} AS record_count`);
  }

  const selectParts = [
    ...dimensions.map((dim) => `${dim.expression} AS ${dim.field}`),
    ...metrics
  ];

  const whereParts = [];
  const params = [];

  for (const filter of plan.filters || []) {
    appendFilterSql(filter, params, whereParts);
  }

  let sql = `
    SELECT
      ${selectParts.join(",\n      ")}
    FROM attendance_daily a
    JOIN students st ON st.id = a.student_id
    JOIN sections sec ON sec.id = a.section_id
    JOIN schools sch ON sch.id = st.school_id
    LEFT JOIN courses c ON c.id = sec.course_id
    LEFT JOIN teachers t ON t.id = sec.teacher_id
  `;

  if (whereParts.length) {
    sql += `\nWHERE ${whereParts.join(" AND ")}`;
  }

  if (dimensions.length) {
    sql += `\nGROUP BY ${dimensions.map((d) => d.expression).join(", ")}`;
  }

  const sortableAliases = new Set([
    ...plan.columns,
    ...(plan.metrics || []).map((metric) => metric.name),
    "record_count"
  ]);

  const orderParts = [];
  for (const order of plan.sort || []) {
    if (!sortableAliases.has(order.field)) continue;
    if (!["ASC", "DESC"].includes(order.direction)) continue;
    orderParts.push(`${order.field} ${order.direction}`);
  }

  if (orderParts.length) {
    sql += `\nORDER BY ${orderParts.join(", ")}`;
  }

  params.push(Math.min(plan.limit || 200, 1000));
  sql += `\nLIMIT $${params.length}`;

  return { sql, params };
}

module.exports = {
  buildSql
};
