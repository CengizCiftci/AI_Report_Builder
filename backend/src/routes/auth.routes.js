const express = require("express");
const { z } = require("zod");
const { login } = require("../services/auth-service");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(1),
        password: z.string().min(1)
      })
      .parse(req.body);

    const session = await login(body);
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = { authRouter: router };
