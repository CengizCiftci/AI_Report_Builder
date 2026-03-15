const { HttpError } = require("../utils/http-error");

function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      details: err.details || null
    });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      details: err.issues
    });
  }

  console.error(err);
  return res.status(500).json({
    error: "Internal server error"
  });
}

module.exports = { errorHandler };
