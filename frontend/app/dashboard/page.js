"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { createReportPlan, executeReport } from "@/lib/api";

function composePlannerPrompt(promptHistory, latestPrompt, clarificationQuestion) {
  const prompts = [...promptHistory, latestPrompt]
    .map((item) => item.trim())
    .filter(Boolean);

  const lines = ["Report request conversation:"];
  prompts.forEach((item, idx) => {
    lines.push(`User prompt ${idx + 1}: ${item}`);
  });

  if (clarificationQuestion) {
    lines.push(
      `The latest user prompt is an answer to this clarification question: ${clarificationQuestion}`
    );
  }

  return lines.join("\n");
}

function JsonPreview({ title, data }) {
  if (!data) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#0f172a", color: "#e2e8f0", overflowX: "auto" }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: "#94a3b8" }}>
        {title}
      </Typography>
      <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(data, null, 2)}</pre>
    </Paper>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState(
    "Sonbahar dönemi için 9. sınıf bazında derslere göre devamsızlık oranı ve öğrenci sayısını getir."
  );
  const [planResult, setPlanResult] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingExec, setLoadingExec] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [promptHistory, setPromptHistory] = useState([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("sqlbuilder_token");
    const savedUser = localStorage.getItem("sqlbuilder_user");

    if (!savedToken) {
      router.replace("/login");
      return;
    }

    setToken(savedToken);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [router]);

  const scopedPlan = planResult?.scopedPlan;

  const tableColumns = useMemo(() => {
    if (!execResult?.rows?.length) return [];
    return Object.keys(execResult.rows[0]);
  }, [execResult]);

  async function handleDryRun() {
    await runReport(scopedPlan, true);
  }

  async function runReport(plan, dryRun = false) {
    if (!plan) return;
    setLoadingExec(true);
    setError("");

    try {
      const result = await executeReport(token, plan, dryRun);
      setExecResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingExec(false);
    }
  }

  async function handleRunReport(planOverride) {
    await runReport(planOverride || scopedPlan, false);
  }
  

  async function handleGeneratePlan() {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setError("Lütfen rapor talebini girin.");
      return;
    }

    setLoadingPlan(true);
    setError("");
    setExecResult(null);

    try {
      const plannerPrompt = composePlannerPrompt(
        promptHistory,
        nextPrompt,
        clarificationQuestion
      );

      const result = await createReportPlan(token, plannerPrompt);
      setPlanResult(result);

      const nextClarificationQuestion =
        result?.plan?.clarificationQuestion?.trim() || "";

      if (nextClarificationQuestion) {
        setPromptHistory((prev) => [...prev, nextPrompt]);
        setClarificationQuestion(nextClarificationQuestion);
        setPrompt("");
        return;
      }

      setPromptHistory([]);
      setClarificationQuestion("");
      await handleRunReport(result?.scopedPlan);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPlan(false);
    }
  }

  function handleResetPromptFlow() {
    setPromptHistory([]);
    setClarificationQuestion("");
    setPrompt("");
    setError("");
  }

  function handleLogout() {
    localStorage.removeItem("sqlbuilder_token");
    localStorage.removeItem("sqlbuilder_user");
    router.replace("/login");
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Card sx={{ backdropFilter: "blur(8px)", backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="h4">Report Planner</Typography>
                <Typography color="text.secondary">
                  LLM plan üretir, backend deterministic SQL üretir.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {(user?.roles || []).map((role) => (
                  <Chip key={role} label={role} color="primary" variant="outlined" />
                ))}
                <Button variant="outlined" onClick={() => setDebugOpen(true)}>
                  Debug Paneli
                </Button>
                <Button onClick={handleLogout} color="secondary" variant="contained">
                  Çıkış
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Doğal Dil Rapor Talebi</Typography>
              {clarificationQuestion ? (
                <Alert severity="info">
                  <Typography variant="subtitle2">Ek açıklama gerekli</Typography>
                  <Typography variant="body2">{clarificationQuestion}</Typography>
                </Alert>
              ) : null}
              {promptHistory.length ? (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Önceki Promptlar
                  </Typography>
                  <Stack spacing={0.5}>
                    {promptHistory.map((item, idx) => (
                      <Typography key={`${idx}-${item}`} variant="body2" color="text.secondary">
                        {idx + 1}. {item}
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
              ) : null}
              <TextField
                multiline
                minRows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  clarificationQuestion
                    ? "Ek açıklama/yanıt prompt'unu girin"
                    : "Ör: Son 30 günde okul bazında devamsızlık oranı ve öğrenci sayısı"
                }
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleGeneratePlan} disabled={loadingPlan || !token}>
                  {loadingPlan
                    ? "Plan üretiliyor..."
                    : clarificationQuestion
                      ? "Yanıtı Ekle ve Report Plan Üret"
                      : "REPORT Plan Üret"}
                </Button>
                <Button variant="outlined" onClick={handleDryRun} disabled={!scopedPlan || loadingExec || loadingPlan}>
                  SQL Önizle (Dry Run)
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleRunReport}
                  disabled={!scopedPlan || loadingExec || loadingPlan}
                >
                  {loadingExec ? "Çalışıyor..." : "Raporu Çalıştır"}
                </Button>
                {(clarificationQuestion || promptHistory.length) && (
                  <Button variant="text" color="inherit" onClick={handleResetPromptFlow}>
                    Akışı Sıfırla
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {execResult ? (
          <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Rapor Sonucu</Typography>
                <Typography variant="body2" color="text.secondary">
                  Teknik plan ve SQL detaylarını sağ üstteki <strong>Debug Paneli</strong> üzerinden isteğe bağlı izleyebilirsiniz.
                </Typography>
                <Divider />
                {execResult.rows?.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {tableColumns.map((column) => (
                          <TableCell key={column}>{column}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {execResult.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {tableColumns.map((column) => (
                            <TableCell key={`${idx}-${column}`}>{String(row[column])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Dry run veya boş sonuç döndü.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>

      <Drawer anchor="right" open={debugOpen} onClose={() => setDebugOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 520 }, p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Debug Paneli</Typography>
              <IconButton onClick={() => setDebugOpen(false)} aria-label="debug panelini kapat">
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Bu panelde planlama ve SQL üretim adımlarının ham çıktıları yer alır.
            </Typography>
            <Divider />

            <JsonPreview title="LLM Draft Plan (planResult?.plan)" data={planResult?.plan} />
            <JsonPreview title="Scope Uygulanmış Plan (planResult?.scopedPlan)" data={planResult?.scopedPlan} />

            <Paper
              variant="outlined"
              sx={{ p: 2, backgroundColor: "#020617", color: "#e2e8f0", overflowX: "auto" }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1, color: "#94a3b8" }}>
                SQL (execResult.sql)
              </Typography>
              <pre style={{ margin: 0, fontSize: 12 }}>{execResult?.sql || "Henüz SQL üretilmedi."}</pre>
            </Paper>

            <JsonPreview title="SQL Parametreleri (execResult.params)" data={execResult?.params || []} />
          </Stack>
        </Box>
      </Drawer>
    </Container>
  );
}
