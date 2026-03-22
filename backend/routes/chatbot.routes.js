"use strict";

const express = require("express");

const router = express.Router();

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function extractGeminiText(payload) {
  const candidates = payload?.candidates;
  if (!Array.isArray(candidates)) return "";

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    const text = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();

    if (text) return text;
  }

  return "";
}

function buildPrompt(userMessage) {
  return [
    "Bạn là VuiVe Bot của cửa hàng thực phẩm VuaVuiVe.",
    "Trả lời bằng tiếng Việt có dấu, giọng thân thiện, ngắn gọn, rõ ràng.",
    "Ưu tiên hỗ trợ các chủ đề: sản phẩm, danh mục, giá, cách đặt hàng, giao hàng, thanh toán, hỗ trợ khách hàng.",
    "Nếu người dùng hỏi ngoài phạm vi cửa hàng, vẫn trả lời lịch sự nhưng ngắn gọn.",
    "Không bịa chính sách cụ thể nếu không chắc chắn.",
    `Câu hỏi khách hàng: ${userMessage}`,
  ].join("\n");
}

router.post("/", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const userMessage = String(req.body?.message || "").trim();

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: "GEMINI_API_KEY is not configured",
    });
  }

  if (!userMessage) {
    return res.status(400).json({
      success: false,
      message: "Message is required",
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Number(process.env.GEMINI_TIMEOUT_MS || 12000),
  );

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(userMessage) }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 500,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        message: "Gemini request failed",
        detail: errorText,
      });
    }

    const data = await response.json();
    const text = extractGeminiText(data);

    if (!text) {
      return res.status(502).json({
        success: false,
        message: "Gemini returned no text",
      });
    }

    return res.json({
      success: true,
      reply: text,
    });
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return res.status(isAbort ? 504 : 500).json({
      success: false,
      message: isAbort ? "Gemini request timed out" : "Gemini request error",
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

module.exports = router;
