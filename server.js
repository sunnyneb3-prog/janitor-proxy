const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Адрес целевого API (без /chat/completions)
const TARGET = process.env.TARGET_URL || "https://openrouter.ai/api/v1";
// Ваш реальный ключ API хранится на сервере
const API_KEY = process.env.API_KEY;
// Пароль для доступа к вашему прокси (вводится в Janitor как API key)
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

app.get("/", (req, res) => res.send("Proxy is running"));

// Проверка пароля
app.use("/v1", (req, res, next) => {
  if (PROXY_PASSWORD) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${PROXY_PASSWORD}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
});

// Список моделей (на всякий случай)
app.get("/v1/models", async (req, res) => {
  try {
    const r = await fetch(`${TARGET}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Основной эндпоинт
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const upstream = await fetch(`${TARGET}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );

    // Поддержка стриминга
    if (req.body.stream && upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      return res.end();
    }

    res.send(await upstream.text());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
