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
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import {
  createAdminEntity,
  createAdminField,
  createAdminMetric,
  createAdminRelationship,
  createAdminSynonym,
  getAdminAnalyticsSummary,
  getAdminDictionary,
  getAdminQueryLogs
} from "@/lib/api";

const LOG_STATUS_FILTERS = ["all", "success", "error", "dry_run"];

export default function AdminPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingDictionary, setLoadingDictionary] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [activity, setActivity] = useState({
    plans_per_day: [],
    query_runs_per_day: []
  });

  const [dictionary, setDictionary] = useState({
    entities: [],
    synonyms: [],
    metrics: [],
    relationships: [],
    fields: []
  });

  const [queryLogs, setQueryLogs] = useState([]);
  const [queryLogPagination, setQueryLogPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [logStatusFilter, setLogStatusFilter] = useState("all");

  const [entityForm, setEntityForm] = useState({
    key: "",
    label: "",
    description: ""
  });
  const [synonymForm, setSynonymForm] = useState({
    entityKey: "",
    synonymText: ""
  });
  const [metricForm, setMetricForm] = useState({
    key: "",
    label: "",
    formulaType: "sum",
    numeratorField: "",
    denominatorField: "",
    aggregationDefault: "SUM"
  });
  const [fieldForm, setFieldForm] = useState({
    fieldKey: "",
    entityKey: "",
    dataType: "text",
    isGroupable: true,
    isFilterable: true,
    isAggregatable: false
  });
  const [relationshipForm, setRelationshipForm] = useState({
    fromEntity: "",
    toEntity: "",
    joinPath: "",
    cardinality: "N:1"
  });

  const adminRoles = useMemo(
    () => ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    []
  );

  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.some((role) => adminRoles.includes(role));
  }, [adminRoles, user]);

  useEffect(() => {
    const savedToken = localStorage.getItem("sqlbuilder_token");
    const savedUser = localStorage.getItem("sqlbuilder_user");

    if (!savedToken || !savedUser) {
      router.replace("/login");
      return;
    }

    const parsedUser = JSON.parse(savedUser);
    setToken(savedToken);
    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    loadAll();
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    loadQueryLogs({ offset: 0 });
  }, [token, isAdmin, logStatusFilter]);

  function formatDate(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  }

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  async function loadAnalytics() {
    setLoadingOverview(true);
    try {
      const response = await getAdminAnalyticsSummary(token);
      setAnalyticsSummary(response?.summary || null);
      setActivity(
        response?.activity || { plans_per_day: [], query_runs_per_day: [] }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOverview(false);
    }
  }

  async function loadDictionary() {
    setLoadingDictionary(true);
    try {
      const response = await getAdminDictionary(token);
      setDictionary(response || {
        entities: [],
        synonyms: [],
        metrics: [],
        relationships: [],
        fields: []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDictionary(false);
    }
  }

  async function loadQueryLogs({ offset = 0 } = {}) {
    setLoadingLogs(true);
    try {
      const response = await getAdminQueryLogs(token, {
        limit: queryLogPagination.limit,
        offset,
        status: logStatusFilter === "all" ? undefined : logStatusFilter
      });

      const items = response?.items || [];
      const pagination = response?.pagination || {
        limit: queryLogPagination.limit,
        offset,
        total: items.length,
        hasMore: false
      };

      setQueryLogPagination(pagination);
      setQueryLogs((prev) => (offset > 0 ? [...prev, ...items] : items));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function loadAll() {
    clearMessages();
    await Promise.all([loadAnalytics(), loadDictionary(), loadQueryLogs({ offset: 0 })]);
  }

  async function handleCreateEntity(event) {
    event.preventDefault();
    clearMessages();
    try {
      await createAdminEntity(token, {
        key: entityForm.key,
        label: entityForm.label,
        description: entityForm.description || null
      });
      setSuccessMessage("Entity added.");
      setEntityForm({ key: "", label: "", description: "" });
      await loadDictionary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateSynonym(event) {
    event.preventDefault();
    clearMessages();
    try {
      await createAdminSynonym(token, synonymForm);
      setSuccessMessage("Synonym added.");
      setSynonymForm({ entityKey: "", synonymText: "" });
      await loadDictionary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateMetric(event) {
    event.preventDefault();
    clearMessages();
    try {
      await createAdminMetric(token, {
        ...metricForm,
        numeratorField: metricForm.numeratorField || null,
        denominatorField: metricForm.denominatorField || null
      });
      setSuccessMessage("Metric added.");
      setMetricForm({
        key: "",
        label: "",
        formulaType: "sum",
        numeratorField: "",
        denominatorField: "",
        aggregationDefault: "SUM"
      });
      await loadDictionary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateField(event) {
    event.preventDefault();
    clearMessages();
    try {
      await createAdminField(token, fieldForm);
      setSuccessMessage("Field added.");
      setFieldForm({
        fieldKey: "",
        entityKey: "",
        dataType: "text",
        isGroupable: true,
        isFilterable: true,
        isAggregatable: false
      });
      await loadDictionary();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateRelationship(event) {
    event.preventDefault();
    clearMessages();
    try {
      await createAdminRelationship(token, relationshipForm);
      setSuccessMessage("Relationship added.");
      setRelationshipForm({
        fromEntity: "",
        toEntity: "",
        joinPath: "",
        cardinality: "N:1"
      });
      await loadDictionary();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Admin Dashboard</Typography>
              <Alert severity="warning">
                You do not have permission to access this page.
              </Alert>
              <Button variant="contained" onClick={() => router.replace("/dashboard")}>Go to Dashboard</Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h4">Admin Dashboard</Typography>
                <Typography color="text.secondary">
                  Dictionary management, usage analytics, success metrics, and query logs.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {(user?.roles || []).map((role) => (
                  <Chip key={role} label={role} color="primary" variant="outlined" />
                ))}
                <Button variant="outlined" onClick={() => router.push("/dashboard")}>Back to App</Button>
                <Button variant="contained" onClick={loadAll}>Refresh</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Report Plans</Typography>
              <Typography variant="h5">{analyticsSummary?.total_report_plans ?? 0}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Generated Plans</Typography>
              <Typography variant="h5">{analyticsSummary?.generated_report_plans ?? 0}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Query Success Rate</Typography>
              <Typography variant="h5">{analyticsSummary?.query_success_rate ?? 0}%</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Avg Plan Confidence</Typography>
              <Typography variant="h5">
                {Number.isFinite(Number(analyticsSummary?.avg_plan_confidence))
                  ? Number(analyticsSummary?.avg_plan_confidence).toFixed(2)
                  : "0.00"}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Usage Activity (Last 14 Days)</Typography>
              {loadingOverview ? (
                <Typography variant="body2" color="text.secondary">Loading analytics...</Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Day</TableCell>
                        <TableCell>Plans Created</TableCell>
                        <TableCell>Query Runs</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const plansByDay = Object.fromEntries(
                          (activity?.plans_per_day || []).map((row) => [row.day, row.count])
                        );
                        const runsByDay = Object.fromEntries(
                          (activity?.query_runs_per_day || []).map((row) => [row.day, row.count])
                        );
                        const days = Array.from(
                          new Set([
                            ...Object.keys(plansByDay),
                            ...Object.keys(runsByDay)
                          ])
                        ).sort();

                        if (!days.length) {
                          return (
                            <TableRow>
                              <TableCell colSpan={3}>No activity yet.</TableCell>
                            </TableRow>
                          );
                        }

                        return days.map((day) => (
                          <TableRow key={day}>
                            <TableCell>{day}</TableCell>
                            <TableCell>{plansByDay[day] || 0}</TableCell>
                            <TableCell>{runsByDay[day] || 0}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Dictionary Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Counts: {dictionary.entities.length} entities, {dictionary.synonyms.length} synonyms, {dictionary.metrics.length} metrics, {dictionary.relationships.length} relationships, {dictionary.fields.length} fields.
              </Typography>
              {loadingDictionary ? <Typography variant="body2">Loading dictionary...</Typography> : null}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Entity</Typography>
                    <Box component="form" onSubmit={handleCreateEntity}>
                      <Stack spacing={1}>
                        <TextField label="Key" value={entityForm.key} onChange={(e) => setEntityForm((prev) => ({ ...prev, key: e.target.value }))} required />
                        <TextField label="Label" value={entityForm.label} onChange={(e) => setEntityForm((prev) => ({ ...prev, label: e.target.value }))} required />
                        <TextField label="Description" value={entityForm.description} onChange={(e) => setEntityForm((prev) => ({ ...prev, description: e.target.value }))} />
                        <Button type="submit" variant="contained">Create Entity</Button>
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Synonym</Typography>
                    <Box component="form" onSubmit={handleCreateSynonym}>
                      <Stack spacing={1}>
                        <TextField
                          select
                          label="Entity"
                          value={synonymForm.entityKey}
                          onChange={(e) => setSynonymForm((prev) => ({ ...prev, entityKey: e.target.value }))}
                          required
                        >
                          {dictionary.entities.map((entity) => (
                            <MenuItem key={entity.id} value={entity.key}>{entity.key}</MenuItem>
                          ))}
                        </TextField>
                        <TextField label="Synonym" value={synonymForm.synonymText} onChange={(e) => setSynonymForm((prev) => ({ ...prev, synonymText: e.target.value }))} required />
                        <Button type="submit" variant="contained">Create Synonym</Button>
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Metric</Typography>
                    <Box component="form" onSubmit={handleCreateMetric}>
                      <Stack spacing={1}>
                        <TextField label="Key" value={metricForm.key} onChange={(e) => setMetricForm((prev) => ({ ...prev, key: e.target.value }))} required />
                        <TextField label="Label" value={metricForm.label} onChange={(e) => setMetricForm((prev) => ({ ...prev, label: e.target.value }))} required />
                        <TextField label="Formula Type" value={metricForm.formulaType} onChange={(e) => setMetricForm((prev) => ({ ...prev, formulaType: e.target.value }))} required />
                        <TextField label="Aggregation Default" value={metricForm.aggregationDefault} onChange={(e) => setMetricForm((prev) => ({ ...prev, aggregationDefault: e.target.value }))} required />
                        <TextField label="Numerator Field" value={metricForm.numeratorField} onChange={(e) => setMetricForm((prev) => ({ ...prev, numeratorField: e.target.value }))} />
                        <TextField label="Denominator Field" value={metricForm.denominatorField} onChange={(e) => setMetricForm((prev) => ({ ...prev, denominatorField: e.target.value }))} />
                        <Button type="submit" variant="contained">Create Metric</Button>
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Field</Typography>
                    <Box component="form" onSubmit={handleCreateField}>
                      <Stack spacing={1}>
                        <TextField label="Field Key" value={fieldForm.fieldKey} onChange={(e) => setFieldForm((prev) => ({ ...prev, fieldKey: e.target.value }))} required />
                        <TextField
                          select
                          label="Entity Key"
                          value={fieldForm.entityKey}
                          onChange={(e) => setFieldForm((prev) => ({ ...prev, entityKey: e.target.value }))}
                          required
                        >
                          {dictionary.entities.map((entity) => (
                            <MenuItem key={entity.id} value={entity.key}>{entity.key}</MenuItem>
                          ))}
                        </TextField>
                        <TextField label="Data Type" value={fieldForm.dataType} onChange={(e) => setFieldForm((prev) => ({ ...prev, dataType: e.target.value }))} required />
                        <TextField
                          select
                          label="Groupable"
                          value={fieldForm.isGroupable ? "true" : "false"}
                          onChange={(e) => setFieldForm((prev) => ({ ...prev, isGroupable: e.target.value === "true" }))}
                        >
                          <MenuItem value="true">true</MenuItem>
                          <MenuItem value="false">false</MenuItem>
                        </TextField>
                        <TextField
                          select
                          label="Filterable"
                          value={fieldForm.isFilterable ? "true" : "false"}
                          onChange={(e) => setFieldForm((prev) => ({ ...prev, isFilterable: e.target.value === "true" }))}
                        >
                          <MenuItem value="true">true</MenuItem>
                          <MenuItem value="false">false</MenuItem>
                        </TextField>
                        <TextField
                          select
                          label="Aggregatable"
                          value={fieldForm.isAggregatable ? "true" : "false"}
                          onChange={(e) => setFieldForm((prev) => ({ ...prev, isAggregatable: e.target.value === "true" }))}
                        >
                          <MenuItem value="true">true</MenuItem>
                          <MenuItem value="false">false</MenuItem>
                        </TextField>
                        <Button type="submit" variant="contained">Create Field</Button>
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Add Relationship</Typography>
                    <Box component="form" onSubmit={handleCreateRelationship}>
                      <Grid container spacing={1}>
                        <Grid item xs={12} md={3}>
                          <TextField fullWidth label="From Entity" value={relationshipForm.fromEntity} onChange={(e) => setRelationshipForm((prev) => ({ ...prev, fromEntity: e.target.value }))} required />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField fullWidth label="To Entity" value={relationshipForm.toEntity} onChange={(e) => setRelationshipForm((prev) => ({ ...prev, toEntity: e.target.value }))} required />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Join Path" value={relationshipForm.joinPath} onChange={(e) => setRelationshipForm((prev) => ({ ...prev, joinPath: e.target.value }))} required />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <TextField fullWidth label="Cardinality" value={relationshipForm.cardinality} onChange={(e) => setRelationshipForm((prev) => ({ ...prev, cardinality: e.target.value }))} required />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <Button type="submit" variant="contained" fullWidth sx={{ height: "100%" }}>Create</Button>
                        </Grid>
                      </Grid>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: "var(--paper-surface)" }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                <Typography variant="h6">Query Logs</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={logStatusFilter}
                    onChange={(e) => setLogStatusFilter(e.target.value)}
                    sx={{ minWidth: 160 }}
                  >
                    {LOG_STATUS_FILTERS.map((status) => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </TextField>
                  <Button variant="outlined" onClick={() => loadQueryLogs({ offset: 0 })} disabled={loadingLogs}>
                    {loadingLogs ? "Loading..." : "Refresh Logs"}
                  </Button>
                </Stack>
              </Stack>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Created</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Rows</TableCell>
                      <TableCell>Exec (ms)</TableCell>
                      <TableCell>Dry Run</TableCell>
                      <TableCell>SQL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!queryLogs.length ? (
                      <TableRow>
                        <TableCell colSpan={7}>No query logs yet.</TableCell>
                      </TableRow>
                    ) : (
                      queryLogs.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.createdAt)}</TableCell>
                          <TableCell>{item.username || "-"}</TableCell>
                          <TableCell>{item.status || "-"}</TableCell>
                          <TableCell>{item.rowCount ?? "-"}</TableCell>
                          <TableCell>{item.executionMs ?? "-"}</TableCell>
                          <TableCell>{item.isDryRun ? "yes" : "no"}</TableCell>
                          <TableCell sx={{ maxWidth: 420 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}
                            >
                              {item.sqlText || "-"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {queryLogPagination.hasMore ? (
                <Box>
                  <Button
                    variant="text"
                    onClick={() => loadQueryLogs({ offset: queryLogs.length })}
                    disabled={loadingLogs}
                  >
                    {loadingLogs ? "Loading..." : "Load More"}
                  </Button>
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
