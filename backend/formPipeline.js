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

    return {
      schema,
      outputType,
      code: reactCode,
      previewHtml: buildPreviewHtml(schema)
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
      previewHtml: buildPreviewHtml(schema)
    };
  }

  const html = await generateCode({ schema, outputType: "html" });
  return { schema, outputType, code: html, previewHtml: html };
}

async function generateCode({ schema, outputType }) {
  const messages = outputType === "react" ? buildReactMessages({ schema }) : buildHtmlMessages({ schema });
  return extractCode(await chatWithOllama(messages));
}

function buildPreviewHtml(schema) {
  const fieldsHtml = flattenFields(schema)
    .map((field) => renderPreviewField(field))
    .join("\n");

  const layoutClass = schema.layout === "two-column" ? " form-grid" : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(schema.title || "Generated Form")}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f7f8fb; color: #172033; padding: 28px; }
    form { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; padding: 24px; box-shadow: 0 16px 45px rgba(25, 38, 70, 0.08); }
    h1 { margin: 0 0 10px; font-size: 26px; }
    p { margin: 0 0 20px; color: #5f6b7a; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { font-weight: 700; margin-bottom: 14px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .field { display: grid; gap: 6px; margin-bottom: 16px; }
    label { font-weight: 700; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #bec8d6; border-radius: 8px; padding: 11px 12px; font: inherit; }
    textarea { min-height: 104px; resize: vertical; }
    .choice { display: flex; align-items: center; gap: 8px; font-weight: 400; }
    .choice input { width: auto; }
    .actions { grid-column: 1 / -1; margin-top: 8px; }
    button { border: 0; border-radius: 8px; background: #2563eb; color: #fff; padding: 12px 16px; font-weight: 700; }
    @media (max-width: 720px) { .form-grid { grid-template-columns: 1fr; } body { padding: 16px; } }
  </style>
</head>
<body>
  <form>
    <h1>${escapeHtml(schema.title || "Generated Form")}</h1>
    ${schema.description ? `<p>${escapeHtml(schema.description)}</p>` : ""}
    <fieldset>
      <legend>${escapeHtml(schema.sections?.[0]?.title || "Form Details")}</legend>
      <div class="${layoutClass.trim()}">
${fieldsHtml}
        <div class="actions">
          <button type="submit">${escapeHtml(schema.submitLabel || "Submit")}</button>
        </div>
      </div>
    </fieldset>
  </form>
</body>
</html>`;
}

function renderPreviewField(field) {
  const attrs = renderPreviewAttributes(field);
  const id = escapeHtml(field.id);
  const label = escapeHtml(field.label);

  if (field.type === "textarea") {
    return `        <div class="field">
          <label for="${id}">${label}</label>
          <textarea id="${id}" name="${id}"${attrs}></textarea>
        </div>`;
  }

  if (field.type === "select") {
    const options = field.options.map((option) => {
      const value = toOptionValue(option);
      return `            <option value="${escapeHtml(value)}">${escapeHtml(option)}</option>`;
    });

    return `        <div class="field">
          <label for="${id}">${label}</label>
          <select id="${id}" name="${id}"${attrs}>
            <option value="">Select ${label}</option>
${options.join("\n")}
          </select>
        </div>`;
  }

  if (field.type === "radio") {
    const options = field.options.map((option) => {
      const value = toOptionValue(option);
      const optionId = `${field.id}-${value}`;
      return `          <label class="choice" for="${escapeHtml(optionId)}">
            <input id="${escapeHtml(optionId)}" name="${id}" type="radio" value="${escapeHtml(value)}"${field.required ? " required" : ""}>
            ${escapeHtml(option)}
          </label>`;
    });

    return `        <div class="field">
          <span>${label}</span>
${options.join("\n")}
        </div>`;
  }

  if (field.type === "checkbox" && field.options.length > 0) {
    const options = field.options.map((option) => {
      const value = toOptionValue(option);
      const optionId = `${field.id}-${value}`;
      return `          <label class="choice" for="${escapeHtml(optionId)}">
            <input id="${escapeHtml(optionId)}" name="${id}" type="checkbox" value="${escapeHtml(value)}">
            ${escapeHtml(option)}
          </label>`;
    });

    return `        <div class="field">
          <span>${label}</span>
${options.join("\n")}
        </div>`;
  }

  return `        <div class="field">
          <label for="${id}">${label}</label>
          <input id="${id}" name="${id}" type="${escapeHtml(field.type)}"${attrs}>
        </div>`;
}

function renderPreviewAttributes(field) {
  const validation = field.validation || {};
  const attrs = [];

  if (field.required) attrs.push("required");
  if (field.placeholder) attrs.push(`placeholder="${escapeHtml(field.placeholder)}"`);
  if (field.autocomplete) attrs.push(`autocomplete="${escapeHtml(field.autocomplete)}"`);
  if (validation.min !== undefined) attrs.push(`min="${escapeHtml(validation.min)}"`);
  if (validation.max !== undefined) attrs.push(`max="${escapeHtml(validation.max)}"`);
  if (validation.minLength !== undefined) attrs.push(`minlength="${escapeHtml(validation.minLength)}"`);
  if (validation.maxLength !== undefined) attrs.push(`maxlength="${escapeHtml(validation.maxLength)}"`);
  if (validation.acceptedFileTypes) attrs.push(`accept="${escapeHtml(validation.acceptedFileTypes)}"`);
  if (validation.pattern && field.type !== "email") attrs.push(`pattern="${escapeHtml(validation.pattern)}"`);

  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function flattenFields(schema) {
  if (!schema || !Array.isArray(schema.sections)) return [];
  return schema.sections.flatMap((section) => (Array.isArray(section.fields) ? section.fields : []));
}

function toOptionValue(option) {
  return String(option || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
