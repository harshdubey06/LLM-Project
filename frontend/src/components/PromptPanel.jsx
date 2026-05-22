export default function PromptPanel({
  requirement,
  outputType,
  isLoading,
  canGenerate,
  error,
  onRequirementChange,
  onOutputTypeChange,
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

      {error ? <p className="error-message">{error}</p> : null}

      <button className="primary-action" type="button" disabled={!canGenerate} onClick={onGenerate}>
        {isLoading ? "Generating..." : "Generate form"}
      </button>
    </section>
  );
}
