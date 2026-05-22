import express from "express";
import cors from "cors";
import { buildPrompt } from "./prompts.js";
import { generateWithOllama } from "./ollamaClient.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ success: true });
});

app.post("/api/generate-form", async (request, response) => {
  const requirement = String(request.body?.requirement || "").trim();
  const outputType = request.body?.outputType === "react" ? "react" : "html";
  const layoutPreference = normalizeLayoutPreference(request.body?.layoutPreference);

  if (!requirement) {
    return response.status(400).json({
      success: false,
      error: "Enter a form requirement before generating."
    });
  }

  try {
    const prompt = buildPrompt({ requirement, outputType, layoutPreference });
    const code = await generateWithOllama(prompt);

    if (!isValidGeneratedForm(code, outputType)) {
      return response.status(422).json({
        success: false,
        error: "The model returned code that does not look like a valid form. Try regenerating."
      });
    }

    return response.json({ success: true, code, outputType });
  } catch (error) {
    return response.status(502).json({
      success: false,
      error: friendlyOllamaError(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

function isValidGeneratedForm(code, outputType) {
  if (!code || typeof code !== "string") return false;
  if (outputType === "react") return /<form[\s>]/i.test(code);
  return /<form[\s>]/i.test(code) && /<\/form>/i.test(code);
}

function normalizeLayoutPreference(value) {
  const allowed = new Set(["single-column", "two-column", "card-sections", "multi-step"]);
  return allowed.has(value) ? value : "two-column";
}

function friendlyOllamaError(error) {
  const message = error?.message || "";

  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    return "Ollama is not running. Start it using ollama serve.";
  }

  if (message.toLowerCase().includes("model")) {
    return "Qwen model not found. Run ollama pull qwen2.5-coder:7b.";
  }

  return "Unable to generate form code. Please try again.";
}
