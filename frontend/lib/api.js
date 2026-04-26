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

export async function getReportHistory(
  token,
  { limit = 20, offset = 0 } = {}
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  return request(`/reports/history?${params.toString()}`, { token });
}

export async function transcribeAudio(token, audioBlob) {
  const formData = new FormData();
  const mimeType = audioBlob?.type || "audio/webm";
  const extension = mimeType.split("/")[1] || "webm";
  formData.append("audio", audioBlob, `voice-input.${extension}`);

  const response = await fetch(`${API_BASE}/speech/transcribe`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Transcription request failed");
  }

  return payload;
}
