"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Typography,
  TableContainer,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { createReportPlan, executeReport, transcribeAudio } from "@/lib/api";

function composePlannerPrompt(
  promptHistory,
  latestPrompt,
  clarificationQuestion,
) {
  const prompts = [...promptHistory, latestPrompt]
    .map((item) => item.trim())
    .filter(Boolean);

  const lines = ["Report request conversation:"];
  prompts.forEach((item, idx) => {
    lines.push(`User prompt ${idx + 1}: ${item}`);
  });

  if (clarificationQuestion) {
    lines.push(
      `The latest user prompt is an answer to this clarification question: ${clarificationQuestion}`,
    );
  }

  return lines.join("\n");
}

function JsonPreview({ title, data }) {
  if (!data) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        overflowX: "auto",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, color: "#94a3b8" }}>
        {title}
      </Typography>
      <pre style={{ margin: 0, fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </Paper>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState(
    "Example: Absenteeism rate and student count by school in the last 30 days",
  );
  const [planResult, setPlanResult] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingExec, setLoadingExec] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [promptHistory, setPromptHistory] = useState([]);
  const [voiceState, setVoiceState] = useState("idle");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const scopedPlan = planResult?.scopedPlan;

  const tableColumns = useMemo(() => {
    if (!execResult?.rows?.length) return [];
    return Object.keys(execResult.rows[0]);
  }, [execResult]);

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
      setError("Please enter a report request.");
      return;
    }

    setLoadingPlan(true);
    setError("");
    setExecResult(null);

    try {
      const plannerPrompt = composePlannerPrompt(
        promptHistory,
        nextPrompt,
        clarificationQuestion,
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

  function stopActiveStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function transcribeRecordedAudio(audioBlob) {
    setVoiceState("transcribing");
    setError("");

    try {
      const response = await transcribeAudio(token, audioBlob);
      const transcript = response?.text?.trim();

      if (!transcript) {
        throw new Error("No speech detected. Please try again.");
      }

      setPrompt(transcript);
      // setPrompt((prev) => {
      //   const trimmed = prev.trim();
      //   return trimmed ? `${trimmed}\n${transcript}` : transcript;
      // });
    } catch (err) {
      setError(err.message);
    } finally {
      setVoiceState("idle");
    }
  }

  async function handleVoiceCommand() {
    if (voiceState === "recording") {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (typeof window === "undefined") return;

    if (
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    setError("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopActiveStream();
        setVoiceState("idle");
        setError("Voice recording failed. Please try again.");
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        audioChunksRef.current = [];
        stopActiveStream();
        await transcribeRecordedAudio(audioBlob);
      };

      recorder.start();
      setVoiceState("recording");
    } catch (_err) {
      stopActiveStream();
      setVoiceState("idle");
      setError("Microphone access was denied or unavailable.");
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
        <Card
          sx={{
            backdropFilter: "blur(8px)",
            backgroundColor: "var(--paper-surface)",
          }}
        >
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h4">Report Planner</Typography>
                <Typography color="text.secondary">
                  LLM generates the plan, backend generates deterministic SQL.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {(user?.roles || []).map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                <Button
                  onClick={handleLogout}
                  color="secondary"
                  variant="contained"
                >
                  Logout
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Natural Language Request</Typography>
              {clarificationQuestion ? (
                <Alert severity="info">
                  <Typography variant="subtitle2">
                    Additional Information Required
                  </Typography>
                  <Typography variant="body2">
                    {clarificationQuestion}
                  </Typography>
                </Alert>
              ) : null}
              {promptHistory.length ? (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Previous Prompts
                  </Typography>
                  <Stack spacing={0.5}>
                    {promptHistory.map((item, idx) => (
                      <Typography
                        key={`${idx}-${item}`}
                        variant="body2"
                        color="text.secondary"
                      >
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
                    ? "Additional Information Prompt"
                    : "Example: Absenteeism rate and student count by school in the last 30 days"
                }
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ flexWrap: "wrap" }}
              >
                <Button
                  variant="contained"
                  onClick={handleGeneratePlan}
                  disabled={loadingPlan || !token}
                >
                  {loadingPlan
                    ? "Generating Plan..."
                    : clarificationQuestion
                      ? "Add Response and Generate Report Plan"
                    : "Generate Report Plan"}
                </Button>
                <Button
                  variant={voiceState === "recording" ? "contained" : "outlined"}
                  color={voiceState === "recording" ? "error" : "primary"}
                  startIcon={
                    voiceState === "recording" ? <StopCircleIcon /> : <MicIcon />
                  }
                  onClick={handleVoiceCommand}
                  disabled={
                    !token ||
                    loadingPlan ||
                    loadingExec ||
                    voiceState === "transcribing"
                  }
                >
                  {voiceState === "recording"
                    ? "Stop Recording"
                    : voiceState === "transcribing"
                      ? "Transcribing..."
                      : "Voice Command"}
                </Button>
                {clarificationQuestion || promptHistory.length ? (
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={handleResetPromptFlow}
                  >
                    Reset Flow
                  </Button>
                ) : null}
              </Stack>
              {voiceState === "recording" ? (
                <Typography variant="body2" color="error">
                  Listening... click Stop Recording when you finish speaking.
                </Typography>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {execResult ? (
          <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
            <CardContent>
              {/* Header */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="h6">Report Result</Typography>

                  <Typography color="text.secondary">
                    Total rows: {execResult.rows?.length ?? 0}
                  </Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Button variant="outlined" onClick={() => setDebugOpen(true)}>
                    Report Plan Panel
                  </Button>
                </Box>
              </Stack>
              <Divider sx={{ mb: 2 }} />

              {/* Table Area */}
              {execResult.rows?.length ? (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflowX: "auto",
                    backgroundColor: "background.paper",
                  }}
                >
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ mt: 2, borderRadius: 2 }}
                  >
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
                              <TableCell key={`${idx}-${column}`}>
                                {String(row[column])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Empty result returned.
                </Typography>
              )}
            </CardContent>
          </Card>
        ) : null}
      </Stack>

      <Drawer
        anchor="right"
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
      >
        <Box sx={{ width: { xs: "100vw", sm: 520 }, p: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6">Report Plan Panel</Typography>
              <IconButton
                onClick={() => setDebugOpen(false)}
                aria-label="Close Report Plan Panel"
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              This panel contains the raw outputs of the planning and SQL
              generation steps.
            </Typography>
            <Divider />

            <JsonPreview
              title="LLM Draft Plan (planResult?.plan)"
              data={planResult?.plan}
            />
            <JsonPreview
              title="Scoped Plan (planResult?.scopedPlan)"
              data={planResult?.scopedPlan}
            />
            <JsonPreview title="Plan Confidence" data={planResult?.confidence} />
            <JsonPreview
              title="Validation Errors"
              data={planResult?.validationErrors}
            />
            <JsonPreview title="Audit Log" data={planResult?.auditLog} />

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: "#020617",
                color: "#e2e8f0",
                overflowX: "auto",
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1, color: "#94a3b8" }}>
                SQL (execResult.sql)
              </Typography>
              <pre style={{ margin: 0, fontSize: 12 }}>
                {execResult?.sql || "SQL not yet generated."}
              </pre>
            </Paper>

            <JsonPreview
              title="SQL Parameters (execResult.params)"
              data={execResult?.params || []}
            />
          </Stack>
        </Box>
      </Drawer>
    </Container>
  );
}
