const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }

  return payload;
}

export async function login(payload) {
  return request("/auth/login", { method: "POST", body: payload });
}

export async function getDictionary(token) {
  return request("/dictionary", { token });
}

export async function createReportPlan(token, prompt) {
  return request("/reports/plan", {
    method: "POST",
    token,
    body: { prompt }
  });
}

export async function executeReport(token, plan, dryRun = false) {
  return request("/reports/execute", {
    method: "POST",
    token,
    body: { plan, dryRun }
  });
}
