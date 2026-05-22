export default function PromptPanel({
  requirement,
  outputType,
  layoutPreference,
  isLoading,
  canGenerate,
  error,
  onRequirementChange,
  onOutputTypeChange,
  onLayoutPreferenceChange,
  onGenerate
}) {
  return (
    <section className="prompt-panel" aria-label="Form requirement">
      <div className="panel-heading">
        <p className="eyebrow">Local Qwen + Ollama</p>
        <h1>AI-Powered Form Builder</h1>
      </div>

      <label className="field-label" htmlFor="requirement">
        Form requirement
      </label>
      <textarea
        id="requirement"
        value={requirement}
        onChange={(event) => onRequirementChange(event.target.value)}
        placeholder="Create a two-column registration form with name, email, password, date of birth, and resume upload."
      />

      <label className="field-label" htmlFor="output-type">
        Output type
      </label>
      <select id="output-type" value={outputType} onChange={(event) => onOutputTypeChange(event.target.value)}>
        <option value="html">Self-contained HTML</option>
        <option value="react">React component</option>
      </select>

      <label className="field-label" htmlFor="layout-preference">
        Layout
      </label>
      <select
        id="layout-preference"
        value={layoutPreference}
        onChange={(event) => onLayoutPreferenceChange(event.target.value)}
      >
        <option value="single-column">Single-column</option>
        <option value="two-column">Two-column</option>
        <option value="card-sections">Card-based sections</option>
        <option value="multi-step">Multi-step</option>
      </select>

      {error ? <p className="error-message">{error}</p> : null}

      <button className="primary-action" type="button" disabled={!canGenerate} onClick={onGenerate}>
        {isLoading ? "Generating..." : "Generate form"}
      </button>
    </section>
  );
}
