const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic validations
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[WARN] GEMINI_API_KEY is not set in .env. /api/ai requests will fail until it is configured."
  );
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// AI endpoint: forwards prompt to Google Gemini API using server-side API key
app.post("/api/ai", async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid request: 'prompt' is required." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "Server missing GEMINI_API_KEY configuration." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = GEMINI_MODEL;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Gemini API Error]", response.status, errorBody);
      return res.status(502).json({
        error: "Failed to fetch response from Gemini API.",
        status: response.status,
      });
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Tidak ada respons dari AI.";

    res.json({ text });
  } catch (err) {
    console.error("[Server /api/ai Error]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.listen(PORT, () => {
  console.log(`AI backend server listening on port ${PORT}`);
});