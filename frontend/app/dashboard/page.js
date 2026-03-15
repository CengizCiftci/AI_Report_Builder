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
import { createReportPlan, executeReport } from "@/lib/api";

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

  async function handleGeneratePlan() {
    setLoadingPlan(true);
    setError("");
    setExecResult(null);

    try {
      const result = await createReportPlan(token, prompt);
      setPlanResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function handleDryRun() {
    if (!scopedPlan) return;
    setLoadingExec(true);
    setError("");

    try {
      const result = await executeReport(token, scopedPlan, true);
      setExecResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingExec(false);
    }
  }

  async function handleRunReport() {
    if (!scopedPlan) return;
    setLoadingExec(true);
    setError("");

    try {
      const result = await executeReport(token, scopedPlan, false);
      setExecResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingExec(false);
    }
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
              <TextField
                multiline
                minRows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ör: Son 30 günde okul bazında devamsızlık oranı ve öğrenci sayısı"
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleGeneratePlan} disabled={loadingPlan || !token}>
                  {loadingPlan ? "Plan üretiliyor..." : "REPORT Plan Üret"}
                </Button>
                <Button variant="outlined" onClick={handleDryRun} disabled={!scopedPlan || loadingExec}>
                  SQL Önizle (Dry Run)
                </Button>
                <Button variant="contained" color="secondary" onClick={handleRunReport} disabled={!scopedPlan || loadingExec}>
                  {loadingExec ? "Çalışıyor..." : "Raporu Çalıştır"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <JsonPreview title="LLM Draft Plan" data={planResult?.plan} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <JsonPreview title="Scope Uygulanmış Plan" data={planResult?.scopedPlan} />
          </Box>
        </Stack>

        {execResult ? (
          <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">SQL & Sonuç</Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#020617", color: "#e2e8f0", overflowX: "auto" }}>
                  <pre style={{ margin: 0, fontSize: 12 }}>{execResult.sql}</pre>
                </Paper>
                <Typography variant="body2" color="text.secondary">
                  Parametreler: {JSON.stringify(execResult.params || [])}
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
    </Container>
  );
}
