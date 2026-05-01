const { HttpError } = require("../utils/http-error");

function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function collectScopeValues(scopes, key) {
  if (!Array.isArray(scopes)) return [];
  const values = scopes
    .map((scope) => scope?.[key])
    .filter((value) => value !== null && value !== undefined);
  return [...new Set(values)];
}

function normalizeToArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }
  if (value === null || value === undefined) return [];
  return [value];
}

function dedupeByString(values) {
  const map = new Map();
  for (const value of values) {
    map.set(String(value), value);
  }
  return [...map.values()];
}

function intersectByString(requestedValues, allowedValues) {
  const allowedMap = new Map(
    allowedValues.map((allowedValue) => [String(allowedValue), allowedValue])
  );
  const intersection = [];
  const seen = new Set();

  for (const requestedValue of requestedValues) {
    const key = String(requestedValue);
    if (!allowedMap.has(key) || seen.has(key)) continue;
    seen.add(key);
    intersection.push(allowedMap.get(key));
  }

  return intersection;
}

function upsertInFilter(filters, field, values) {
  if (!values.length) return filters;

  const nextFilters = Array.isArray(filters) ? [...filters] : [];
  const idx = nextFilters.findIndex((f) => f.field === field);
  const scopedValues = dedupeByString(values);

  if (idx >= 0) {
    const existingFilter = nextFilters[idx];
    const operator = existingFilter?.operator;

    // If user already requested a value for this field, narrow it by intersection.
    if (operator === "=" || operator === "IN") {
      const requestedValues = normalizeToArray(existingFilter?.value);
      const intersection = intersectByString(requestedValues, scopedValues);

      if (!intersection.length) {
        throw new HttpError(
          403,
          `Requested filter for "${field}" is outside your allowed scope.`
        );
      }

      nextFilters[idx] = {
        field,
        operator: "IN",
        value: intersection
      };
      return nextFilters;
    }

    // Keep original filter semantics and enforce scope with an additional IN filter.
    nextFilters.push({ field, operator: "IN", value: scopedValues });
    return nextFilters;
  }

  nextFilters.push({ field, operator: "IN", value: scopedValues });

  return nextFilters;
}

function applyScopeToPlan(plan, user) {
  if (hasRole(user, "SUPER_ADMIN")) {
    return { ...plan };
  }

  const scopedPlan = JSON.parse(JSON.stringify(plan));
  const scopes = user?.scopes || [];

  const schoolIds = collectScopeValues(scopes, "school_id");
  const gradeLevels = collectScopeValues(scopes, "grade_level");
  const courseIds = collectScopeValues(scopes, "course_id");
  const teacherIds = collectScopeValues(scopes, "teacher_id");

  scopedPlan.filters = upsertInFilter(scopedPlan.filters, "school_id", schoolIds);
  scopedPlan.filters = upsertInFilter(scopedPlan.filters, "grade_level", gradeLevels);
  scopedPlan.filters = upsertInFilter(scopedPlan.filters, "course_id", courseIds);
  scopedPlan.filters = upsertInFilter(scopedPlan.filters, "teacher_id", teacherIds);

  return scopedPlan;
}

module.exports = {
  applyScopeToPlan
};
