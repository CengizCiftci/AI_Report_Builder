const express = require("express");
const multer = require("multer");
const { env } = require("../config/env");
const { authenticate } = require("../middleware/auth");
const { HttpError } = require("../utils/http-error");

const MAX_AUDIO_SIZE_MB = 15;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_MB * 1024 * 1024
  }
});

const router = express.Router();

router.post(
  "/transcribe",
  authenticate,
  upload.single("audio"),
  async (req, res, next) => {
    try {
      if (!env.OPENAI_API_KEY) {
        throw new HttpError(400, "Speech transcription is not configured.");
      }

      if (!req.file || !req.file.buffer?.length) {
        throw new HttpError(400, "Audio file is required.");
      }

      if (!req.file.mimetype?.startsWith("audio/")) {
        throw new HttpError(400, "Only audio files are supported.");
      }

      const model = env.OPENAI_TRANSCRIBE_MODEL;
      const language = env.OPENAI_TRANSCRIBE_LANGUAGE;

      const formData = new FormData();
      const fileType = req.file.mimetype || "audio/webm";
      const extension = fileType.split("/")[1] || "webm";
      const safeFileName = `voice-input.${extension}`;

      formData.append(
        "file",
        new Blob([req.file.buffer], { type: fileType }),
        safeFileName
      );
      formData.append("model", model);
      if (language) {
        formData.append("language", language);
      }

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`
        },
        body: formData
      });

      if (!response.ok) {
        const providerError = await response.text();
        throw new HttpError(502, "Transcription failed.", {
          providerStatus: response.status,
          providerError
        });
      }

      const payload = await response.json();
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";

      if (!text) {
        throw new HttpError(422, "No speech detected. Please try again.");
      }

      return res.json({
        text,
        model
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = { speechRouter: router };
