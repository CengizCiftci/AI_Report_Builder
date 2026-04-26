const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { env } = require("./config/env");
const { authRouter } = require("./routes/auth.routes");
const { dictionaryRouter } = require("./routes/dictionary.routes");
const { reportRouter } = require("./routes/report.routes");
const { speechRouter } = require("./routes/speech.routes");
const { errorHandler } = require("./middleware/error-handler");

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sqlbuilder-backend" });
});

app.use("/api/auth", authRouter);
app.use("/api/dictionary", dictionaryRouter);
app.use("/api/reports", reportRouter);
app.use("/api/speech", speechRouter);

app.use(errorHandler);

module.exports = { app };
