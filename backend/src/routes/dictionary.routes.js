const express = require("express");
const { authenticate } = require("../middleware/auth");
const { getDictionary } = require("../services/dictionary-service");

const router = express.Router();

router.get("/", authenticate, async (_req, res, next) => {
  try {
    const dictionary = await getDictionary();
    return res.json(dictionary);
  } catch (error) {
    return next(error);
  }
});

module.exports = { dictionaryRouter: router };
