import express from "express";
import cors from "cors";
import { continueRequirementInterview, finalizeForm, generateFromSchema } from "./formPipeline.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ success: true });
});

app.post("/api/chat-requirements", async (request, response) => {
  try {
    const result = await continueRequirementInterview({
      messages: Array.isArray(request.body?.messages) ? request.body.messages : [],
      layoutPreference: normalizeLayoutPreference(request.body?.layoutPreference),
      outputType: normalizeOutputType(request.body?.outputType)
    });

    response.json({ success: true, ...result });
  } catch (error) {
    response.status(error.statusCode || 502).json({
      success: false,
      error: friendlyError(error),
      details: error.details || []
    });
  }
});

app.post("/api/finalize-form", async (request, response) => {
  try {
    const result = await finalizeForm({
      messages: Array.isArray(request.body?.messages) ? request.body.messages : [],
      requirement: request.body?.requirement,
      layoutPreference: normalizeLayoutPreference(request.body?.layoutPreference),
      outputType: normalizeOutputType(request.body?.outputType),
      fieldCount: request.body?.fieldCount,
      manualFields: Array.isArray(request.body?.manualFields) ? request.body.manualFields : []
    });

    response.json({ success: true, ...result });
  } catch (error) {
    response.status(error.statusCode || 502).json({
      success: false,
      error: friendlyError(error),
      details: error.details || []
    });
  }
});

app.post("/api/generate-from-schema", async (request, response) => {
  try {
    const result = await generateFromSchema({
      schema: request.body?.schema,
      layoutPreference: normalizeLayoutPreference(request.body?.layoutPreference),
      outputType: normalizeOutputType(request.body?.outputType)
    });

    response.json({ success: true, ...result });
  } catch (error) {
    response.status(error.statusCode || 502).json({
      success: false,
      error: friendlyError(error),
      details: error.details || []
    });
  }
});

app.post("/api/generate-form", async (request, response) => {
  try {
    const result = await finalizeForm({
      messages: Array.isArray(request.body?.messages) ? request.body.messages : [],
      requirement: request.body?.requirement,
      layoutPreference: normalizeLayoutPreference(request.body?.layoutPreference),
      outputType: normalizeOutputType(request.body?.outputType),
      fieldCount: request.body?.fieldCount,
      manualFields: Array.isArray(request.body?.manualFields) ? request.body.manualFields : []
    });

    response.json({ success: true, ...result });
  } catch (error) {
    response.status(error.statusCode || 502).json({
      success: false,
      error: friendlyError(error),
      details: error.details || []
    });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

function normalizeLayoutPreference(value) {
  const allowed = new Set(["single-column", "two-column", "card-sections", "multi-step"]);
  return allowed.has(value) ? value : "two-column";
}

function normalizeOutputType(value) {
  return value === "react" ? "react" : "html";
}

function friendlyError(error) {
  const message = error?.message || "";

  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    return "Ollama is not running. Start it using ollama serve.";
  }

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("model") && (lowerMessage.includes("not found") || lowerMessage.includes("not installed"))) {
    return "Qwen model not found. Run ollama pull qwen2.5-coder:7b.";
  }

  return message || "Unable to generate form code. Please try again.";
}
