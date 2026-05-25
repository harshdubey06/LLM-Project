import { chatWithOllama, extractCode } from "./ollamaClient.js";
import {
  buildHtmlMessages,
  buildInterviewMessages,
  buildReactMessages,
  buildSchemaMessages
} from "./prompts.js";
import { parseJsonObject, normalizeAndValidateSchema } from "./schemaValidator.js";

export async function continueRequirementInterview({ messages, layoutPreference, outputType }) {
  const latestUserMessage = getLatestUserMessage(messages);

  if (!latestUserMessage) {
    return {
      status: "collecting",
      message: "What kind of form do you want to build, and which fields should it include?"
    };
  }

  if (isFinalizationMessage(latestUserMessage)) {
    return { status: "ready_to_finalize" };
  }

  const answer = await chatWithOllama(
    buildInterviewMessages({
      messages,
      layoutPreference,
      outputType,
      latestUserMessage
    })
  );

  if (answer.trim() === "READY_TO_FINALIZE") {
    return { status: "ready_to_finalize" };
  }

  const cleanedAnswer = answer
    .split("\n")
    .filter((line) => line.trim() !== "READY_TO_FINALIZE")
    .join("\n")
    .trim();

  if (!cleanedAnswer) {
    return { status: "ready_to_finalize" };
  }

  return {
    status: "collecting",
    message: cleanedAnswer
  };
}

export async function finalizeForm({ messages, requirement, layoutPreference, outputType, fieldCount, manualFields }) {
  const conversationMessages = normalizeConversation({ messages, requirement });
  const schemaRaw = await chatWithOllama(
    buildSchemaMessages({
      messages: conversationMessages,
      layoutPreference,
      outputType,
      fieldCount,
      manualFields
    })
  );
  const parsedSchema = parseJsonObject(schemaRaw);
  const { schema, errors: schemaErrors } = normalizeAndValidateSchema(parsedSchema, layoutPreference);

  if (schemaErrors.length > 0) {
    throw validationError("The finalized form schema is incomplete.", schemaErrors);
  }

  if (outputType === "react") {
    const reactCode = await generateCode({ schema, outputType: "react" });
    const previewHtml = await generateCode({ schema, outputType: "html" });

    return {
      schema,
      outputType,
      code: reactCode,
      previewHtml
    };
  }

  const html = await generateCode({ schema, outputType: "html" });

  return {
    schema,
    outputType,
    code: html,
    previewHtml: html
  };
}

export async function generateFromSchema({ schema: inputSchema, layoutPreference, outputType }) {
  const { schema, errors: schemaErrors } = normalizeAndValidateSchema(inputSchema, layoutPreference);

  if (schemaErrors.length > 0) {
    throw validationError("The supplied form schema is incomplete.", schemaErrors);
  }

  if (outputType === "react") {
    return {
      schema,
      outputType,
      code: await generateCode({ schema, outputType: "react" }),
      previewHtml: await generateCode({ schema, outputType: "html" })
    };
  }

  const html = await generateCode({ schema, outputType: "html" });
  return { schema, outputType, code: html, previewHtml: html };
}

async function generateCode({ schema, outputType }) {
  const messages = outputType === "react" ? buildReactMessages({ schema }) : buildHtmlMessages({ schema });
  return extractCode(await chatWithOllama(messages));
}

function normalizeConversation({ messages, requirement }) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .filter((message) => message && (message.role === "user" || message.role === "assistant"))
      .map((message) => ({
        role: message.role,
        content: String(message.content || "").trim()
      }))
      .filter((message) => message.content);
  }

  const text = String(requirement || "").trim();
  return text ? [{ role: "user", content: text }] : [];
}

function getLatestUserMessage(messages = []) {
  if (!Array.isArray(messages)) return "";

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return String(messages[index].content || "").trim();
    }
  }

  return "";
}

function isFinalizationMessage(message) {
  return /\b(ok final done|generate now|final|done)\b/i.test(String(message || ""));
}

function validationError(message, details) {
  const error = new Error(message);
  error.statusCode = 422;
  error.details = details;
  return error;
}
