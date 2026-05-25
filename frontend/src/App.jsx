import { useMemo, useState } from "react";
import PromptPanel from "./components/PromptPanel.jsx";
import CodeEditor from "./components/CodeEditor.jsx";
import LivePreview from "./components/LivePreview.jsx";
import Toolbar from "./components/Toolbar.jsx";
import { chatRequirements, finalizeForm, generateFromSchema } from "./services/formApi.js";

const starterCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Form</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f7f8fb; padding: 32px; }
    form { max-width: 520px; margin: auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 12px 30px rgba(20, 30, 60, 0.12); }
    label { display: block; margin-bottom: 6px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 12px; margin-bottom: 16px; border: 1px solid #c8ced8; border-radius: 8px; }
    button { padding: 12px 16px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 700; }
  </style>
</head>
<body>
  <form>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required>
    <button type="submit">Submit</button>
  </form>
</body>
</html>`;

const initialMessages = [
  {
    role: "assistant",
    content:
      "Tell me what form you want to build. I will ask about fields, input types, validations, and layout before generating anything."
  }
];

export default function App() {
  const [mode, setMode] = useState("chat");
  const [messages, setMessages] = useState(initialMessages);
  const [currentMessage, setCurrentMessage] = useState("");
  const [outputType, setOutputType] = useState("html");
  const [layoutPreference, setLayoutPreference] = useState("two-column");
  const [fieldCount, setFieldCount] = useState("");
  const [manualFields, setManualFields] = useState([]);
  const [conversationStatus, setConversationStatus] = useState("collecting");
  const [schema, setSchema] = useState(null);
  const [schemaDraft, setSchemaDraft] = useState("");
  const [code, setCode] = useState(starterCode);
  const [previewHtml, setPreviewHtml] = useState(starterCode);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const userMessages = useMemo(() => messages.filter((message) => message.role === "user"), [messages]);
  const canSend = currentMessage.trim().length > 0 && !isLoading;
  const canFinalize = userMessages.length > 0 && !isLoading;
  const canRegenerate = Boolean(schema) && !isLoading;

  async function handleSendMessage() {
    if (!currentMessage.trim()) return;

    const nextMessages = [...messages, { role: "user", content: currentMessage.trim() }];
    setMessages(nextMessages);
    setCurrentMessage("");
    setError("");
    setIsLoading(true);
    setPhase("Collecting requirements");

    try {
      const result = await chatRequirements({ messages: nextMessages, layoutPreference, outputType });

      if (result.status === "ready_to_finalize") {
        setConversationStatus("ready");
        await handleFinalize(nextMessages);
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: result.message }]);
      setConversationStatus("collecting");
    } catch (err) {
      setError(err.message || "Unable to continue the requirement interview.");
    } finally {
      setIsLoading(false);
      setPhase("");
    }
  }

  async function handleFinalize(messagesToFinalize = messages) {
    if (messagesToFinalize.filter((message) => message.role === "user").length === 0) return;

    setIsLoading(true);
    setError("");
    setConversationStatus("generating");
    setPhase("Building schema");

    try {
      const result = await finalizeForm({
        messages: messagesToFinalize,
        layoutPreference,
        outputType,
        fieldCount,
        manualFields: serializeManualFields(manualFields)
      });

      setPhase("Rendering output");
      setSchema(result.schema);
      setSchemaDraft(JSON.stringify(result.schema, null, 2));
      setCode(result.code);
      setPreviewHtml(result.previewHtml || result.code);
      setConversationStatus("ready");
      setMode("schema");
    } catch (err) {
      setConversationStatus("collecting");
      setError(err.message || "Unable to finalize the form.");
    } finally {
      setIsLoading(false);
      setPhase("");
    }
  }

  async function handleGenerateFromSchema(nextSchema = schema) {
    if (!nextSchema) return;

    setIsLoading(true);
    setError("");
    setPhase("Generating code");

    try {
      const schemaToGenerate = typeof nextSchema === "string" ? JSON.parse(nextSchema) : nextSchema;
      const result = await generateFromSchema({
        schema: schemaToGenerate,
        layoutPreference,
        outputType
      });

      setSchema(result.schema);
      setSchemaDraft(JSON.stringify(result.schema, null, 2));
      setCode(result.code);
      setPreviewHtml(result.previewHtml || result.code);
    } catch (err) {
      setError(err.message || "Unable to regenerate from schema.");
    } finally {
      setIsLoading(false);
      setPhase("");
    }
  }

  function handleManualFieldsChange(nextFields) {
    setManualFields(nextFields);
    setFieldCount(nextFields.length ? String(nextFields.length) : "");
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <PromptPanel
          mode={mode}
          messages={messages}
          currentMessage={currentMessage}
          outputType={outputType}
          layoutPreference={layoutPreference}
          fieldCount={fieldCount}
          manualFields={manualFields}
          conversationStatus={conversationStatus}
          schema={schema}
          schemaDraft={schemaDraft}
          phase={phase}
          isLoading={isLoading}
          canSend={canSend}
          canFinalize={canFinalize}
          error={error}
          onModeChange={setMode}
          onCurrentMessageChange={setCurrentMessage}
          onOutputTypeChange={setOutputType}
          onLayoutPreferenceChange={setLayoutPreference}
          onFieldCountChange={setFieldCount}
          onManualFieldsChange={handleManualFieldsChange}
          onSchemaDraftChange={setSchemaDraft}
          onSendMessage={handleSendMessage}
          onFinalize={() => handleFinalize()}
          onGenerateFromSchema={() => handleGenerateFromSchema(schemaDraft || schema)}
        />
        <LivePreview code={previewHtml} />
      </section>

      <section className="editor-section">
        <Toolbar
          code={code}
          outputType={outputType}
          onRegenerate={() => handleGenerateFromSchema()}
          canRegenerate={canRegenerate}
        />
        <CodeEditor code={code} outputType={outputType} onChange={setCode} />
      </section>
    </main>
  );
}

function serializeManualFields(fields) {
  return fields
    .filter((field) => field.label.trim())
    .map((field) => ({
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      validation: parseValidationNote(field.validationNote),
      options: String(field.optionsText || "")
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean)
    }));
}

function parseValidationNote(note) {
  const validation = {};

  String(note || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, rawValue] = part.split(":").map((value) => value.trim());
      if (!rawKey || rawValue === undefined) return;

      const numericKeys = new Set(["minLength", "maxLength", "min", "max", "maxFileSizeMB"]);
      validation[rawKey] = numericKeys.has(rawKey) ? Number(rawValue) : rawValue;
    });

  return validation;
}
