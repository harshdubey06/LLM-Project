export default function Toolbar({ code, outputType, onRegenerate, canRegenerate }) {
  async function copyCode() {
    await navigator.clipboard.writeText(code);
  }

  function downloadCode() {
    const extension = outputType === "react" ? "jsx" : "html";
    const mimeType = outputType === "react" ? "text/jsx" : "text/html";
    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `generated-form.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="toolbar">
      <h2>Generated code</h2>
      <div className="toolbar-actions">
        <button type="button" onClick={copyCode}>
          Copy
        </button>
        <button type="button" onClick={downloadCode}>
          Download
        </button>
        <button type="button" disabled={!canRegenerate} onClick={onRegenerate}>
          Regenerate
        </button>
      </div>
    </div>
  );
}
