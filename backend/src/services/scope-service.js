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

function upsertInFilter(filters, field, values) {
  if (!values.length) return filters;

  const nextFilters = Array.isArray(filters) ? [...filters] : [];
  const idx = nextFilters.findIndex((f) => f.field === field);

  if (idx >= 0) {
    const existingValue = nextFilters[idx]?.value;
    const existingValues = Array.isArray(existingValue)
      ? existingValue
      : existingValue === null || existingValue === undefined
        ? []
        : [existingValue];

    nextFilters[idx] = {
      field,
      operator: "IN",
      value: [...new Set([...existingValues, ...values])]
    };
  } else {
    nextFilters.push({ field, operator: "IN", value: values });
  }

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
