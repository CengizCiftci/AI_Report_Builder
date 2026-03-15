const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { HttpError } = require("../utils/http-error");

function authenticate(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Unauthorized"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(new HttpError(401, "Invalid token"));
  }
}

module.exports = { authenticate };
