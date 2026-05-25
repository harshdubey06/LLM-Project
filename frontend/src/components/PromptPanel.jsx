const fieldTypes = [
  "text",
  "email",
  "password",
  "tel",
  "number",
  "date",
  "time",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "file"
];

export default function PromptPanel({
  mode,
  messages,
  currentMessage,
  formTitle,
  fieldCount,
  manualFields,
  conversationStatus,
  schema,
  schemaDraft,
  phase,
  isLoading,
  canSend,
  canFinalize,
  canGenerateWizard,
  error,
  onModeChange,
  onCurrentMessageChange,
  onFormTitleChange,
  onFieldCountChange,
  onManualFieldsChange,
  onSchemaDraftChange,
  onSendMessage,
  onFinalize,
  onGenerateFromWizard,
  onGenerateFromSchema
}) {
  return (
    <section className="prompt-panel" aria-label="Form requirement">
      <div className="panel-heading">
        <p className="eyebrow">Local Qwen + Ollama</p>
        <h1>AI-Powered Form Builder</h1>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Builder mode">
        <button type="button" className={mode === "chat" ? "active" : ""} onClick={() => onModeChange("chat")}>
          Chat
        </button>
        <button type="button" className={mode === "wizard" ? "active" : ""} onClick={() => onModeChange("wizard")}>
          Wizard
        </button>
        <button type="button" className={mode === "schema" ? "active" : ""} onClick={() => onModeChange("schema")}>
          Schema
        </button>
      </div>

      {mode === "chat" ? (
        <ChatPanel
          messages={messages}
          currentMessage={currentMessage}
          conversationStatus={conversationStatus}
          phase={phase}
          isLoading={isLoading}
          canSend={canSend}
          canFinalize={canFinalize}
          onCurrentMessageChange={onCurrentMessageChange}
          onSendMessage={onSendMessage}
          onFinalize={onFinalize}
        />
      ) : null}

      {mode === "wizard" ? (
        <WizardPanel
          formTitle={formTitle}
          fieldCount={fieldCount}
          manualFields={manualFields}
          canGenerateWizard={canGenerateWizard}
          isLoading={isLoading}
          onFormTitleChange={onFormTitleChange}
          onFieldCountChange={onFieldCountChange}
          onManualFieldsChange={onManualFieldsChange}
          onGenerateFromWizard={onGenerateFromWizard}
        />
      ) : null}

      {mode === "schema" ? (
        <SchemaPanel
          schema={schema}
          schemaDraft={schemaDraft}
          onSchemaDraftChange={onSchemaDraftChange}
          onGenerateFromSchema={onGenerateFromSchema}
        />
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

function ChatPanel({
  messages,
  currentMessage,
  conversationStatus,
  phase,
  isLoading,
  canSend,
  canFinalize,
  onCurrentMessageChange,
  onSendMessage,
  onFinalize
}) {
  function handleKeyDown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      onSendMessage();
    }
  }

  return (
    <div className="chat-panel">
      <div className="status-line">
        <span>Status: {phase || conversationStatus}</span>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
            <p>{cleanDisplayMessage(message.content)}</p>
          </article>
        ))}
      </div>

      <label className="field-label" htmlFor="chat-message">
        Your answer
      </label>
      <textarea
        id="chat-message"
        className="chat-input"
        value={currentMessage}
        onChange={(event) => onCurrentMessageChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the form or answer the assistant. Type 'ok final done' when the details are complete."
      />

      <div className="quick-replies" aria-label="Quick replies">
        {["All fields required", "Two-column layout", "HTML output", "React output", "Generate now"].map((reply) => (
          <button type="button" key={reply} onClick={() => onCurrentMessageChange(reply)}>
            {reply}
          </button>
        ))}
      </div>

      <div className="action-row">
        <button className="primary-action" type="button" disabled={!canSend} onClick={onSendMessage}>
          {isLoading ? "Working..." : "Send"}
        </button>
        <button type="button" disabled={!canFinalize || isLoading} onClick={onFinalize}>
          Finalize form
        </button>
      </div>
    </div>
  );
}

function WizardPanel({
  formTitle,
  fieldCount,
  manualFields,
  canGenerateWizard,
  isLoading,
  onFormTitleChange,
  onFieldCountChange,
  onManualFieldsChange,
  onGenerateFromWizard
}) {
  function syncFieldCount(count) {
    const nextCount = Math.max(0, Number(count) || 0);
    onFieldCountChange(String(nextCount || ""));

    if (nextCount > manualFields.length) {
      const additions = Array.from({ length: nextCount - manualFields.length }, () => createEmptyField());
      onManualFieldsChange([...manualFields, ...additions]);
    } else {
      onManualFieldsChange(manualFields.slice(0, nextCount));
    }
  }

  function updateField(index, patch) {
    onManualFieldsChange(manualFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  return (
    <div className="wizard-panel">
      <label className="field-label" htmlFor="form-title">
        Form title
      </label>
      <input
        id="form-title"
        type="text"
        placeholder="College Admission Form"
        value={formTitle}
        onChange={(event) => onFormTitleChange(event.target.value)}
      />

      <label className="field-label" htmlFor="field-count">
        Number of fields
      </label>
      <input
        id="field-count"
        type="number"
        min="0"
        value={fieldCount}
        onChange={(event) => syncFieldCount(event.target.value)}
      />

      <div className="manual-fields">
        {manualFields.map((field, index) => (
          <div className="manual-field" key={index}>
            <input
              aria-label={`Field ${index + 1} label`}
              placeholder="Field label"
              value={field.label}
              onChange={(event) => updateField(index, { label: event.target.value })}
            />
            <select
              aria-label={`Field ${index + 1} type`}
              value={field.type}
              onChange={(event) => updateField(index, { type: event.target.value })}
            >
              {fieldTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => updateField(index, { required: event.target.checked })}
              />
              Required
            </label>
            <input
              aria-label={`Field ${index + 1} validation`}
              placeholder="Validation e.g. minLength:2, maxLength:80"
              value={field.validationNote}
              onChange={(event) => updateField(index, { validationNote: event.target.value })}
            />
            <div className="validation-grid">
              <input
                aria-label={`Field ${index + 1} minimum`}
                placeholder="Min"
                value={field.min}
                onChange={(event) => updateField(index, { min: event.target.value })}
              />
              <input
                aria-label={`Field ${index + 1} maximum`}
                placeholder="Max"
                value={field.max}
                onChange={(event) => updateField(index, { max: event.target.value })}
              />
              <input
                aria-label={`Field ${index + 1} minimum length`}
                placeholder="Min length"
                value={field.minLength}
                onChange={(event) => updateField(index, { minLength: event.target.value })}
              />
              <input
                aria-label={`Field ${index + 1} maximum length`}
                placeholder="Max length"
                value={field.maxLength}
                onChange={(event) => updateField(index, { maxLength: event.target.value })}
              />
            </div>
            <input
              aria-label={`Field ${index + 1} pattern`}
              placeholder="Regex pattern"
              value={field.pattern}
              onChange={(event) => updateField(index, { pattern: event.target.value })}
            />
            <input
              aria-label={`Field ${index + 1} accepted file types`}
              placeholder="Accepted files e.g. .pdf,.doc"
              value={field.acceptedFileTypes}
              onChange={(event) => updateField(index, { acceptedFileTypes: event.target.value })}
            />
            <input
              aria-label={`Field ${index + 1} options`}
              placeholder="Options for select/radio, comma separated"
              value={field.optionsText}
              onChange={(event) => updateField(index, { optionsText: event.target.value })}
            />
          </div>
        ))}
      </div>

      <button className="primary-action" type="button" disabled={!canGenerateWizard || isLoading} onClick={onGenerateFromWizard}>
        {isLoading ? "Generating..." : "Generate from wizard"}
      </button>
    </div>
  );
}

function SchemaPanel({ schema, schemaDraft, onSchemaDraftChange, onGenerateFromSchema }) {
  return (
    <div className="schema-panel">
      {schema ? (
        <>
          <textarea
            className="schema-editor"
            value={schemaDraft}
            onChange={(event) => onSchemaDraftChange(event.target.value)}
            spellCheck="false"
          />
          <button className="primary-action" type="button" onClick={onGenerateFromSchema}>
            Regenerate code from schema
          </button>
        </>
      ) : (
        <p className="empty-state">Finalize the conversation to build the schema.</p>
      )}
    </div>
  );
}

function createEmptyField() {
  return {
    label: "",
    type: "text",
    required: false,
    validationNote: "",
    min: "",
    max: "",
    minLength: "",
    maxLength: "",
    pattern: "",
    acceptedFileTypes: "",
    optionsText: ""
  };
}

function cleanDisplayMessage(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .split("\n")
    .filter((line) => !line.trim().startsWith("User:") && !line.trim().startsWith("Assistant:"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
