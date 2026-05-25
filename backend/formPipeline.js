import { chatWithOllama, extractCode } from "./ollamaClient.js";
import {
  buildHtmlMessages,
  buildInterviewMessages,
  buildReactMessages,
  buildRepairMessages,
  buildSchemaMessages
} from "./prompts.js";
import { parseJsonObject, normalizeAndValidateSchema } from "./schemaValidator.js";
import { validateGeneratedCode } from "./codeValidator.js";

export async function continueRequirementInterview({ messages, layoutPreference, outputType }) {
  const latestUserMessage = getLatestUserMessage(messages);

  if (!latestUserMessage) {
    return {
      status: "collecting",
      message: "What kind of form do you want to build, and which fields should it include?"
    };
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

  return {
    status: "collecting",
    message: answer
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
    const reactCode = await generateAndValidateCode({ schema, outputType: "react" });
    const previewHtml = await generateAndValidateCode({ schema, outputType: "html" });

    return {
      schema,
      outputType,
      code: reactCode,
      previewHtml
    };
  }

  const html = await generateAndValidateCode({ schema, outputType: "html" });

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
      code: await generateAndValidateCode({ schema, outputType: "react" }),
      previewHtml: await generateAndValidateCode({ schema, outputType: "html" })
    };
  }

  const html = await generateAndValidateCode({ schema, outputType: "html" });
  return { schema, outputType, code: html, previewHtml: html };
}

async function generateAndValidateCode({ schema, outputType }) {
  const messages = outputType === "react" ? buildReactMessages({ schema }) : buildHtmlMessages({ schema });
  const firstCode = extractCode(await chatWithOllama(messages));
  const firstErrors = validateGeneratedCode(firstCode, outputType, schema);

  if (firstErrors.length === 0) {
    return firstCode;
  }

  const repairedCode = extractCode(
    await chatWithOllama(buildRepairMessages({ schema, outputType, code: firstCode, errors: firstErrors }))
  );
  const repairedErrors = validateGeneratedCode(repairedCode, outputType, schema);

  if (repairedErrors.length > 0) {
    throw validationError("The model returned code that does not match the finalized form.", repairedErrors);
  }

  return repairedCode;
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

function validationError(message, details) {
  const error = new Error(message);
  error.statusCode = 422;
  error.details = details;
  return error;
}
