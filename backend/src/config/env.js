const dotenv = require("dotenv");

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/sqlbuilder",
  JWT_SECRET: process.env.JWT_SECRET || "change-me-in-production",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  OPENAI_TRANSCRIBE_MODEL:
    process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
  OPENAI_TRANSCRIBE_LANGUAGE: process.env.OPENAI_TRANSCRIBE_LANGUAGE || "",
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:3000"
};

module.exports = { env };
