import { downloadReactProject } from "../utils/projectExporter.js";

export default function Toolbar({ code, outputType, onRegenerate, canRegenerate }) {
  async function copyCode() {
    await navigator.clipboard.writeText(code);
  }

  async function downloadCode() {
    if (outputType === "react") {
      try {
        await downloadReactProject(code);
      } catch (error) {
        alert("Failed to export project: " + error.message);
      }
    } else {
      const blob = new Blob([code], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "generated-form.html";
      anchor.click();
      URL.revokeObjectURL(url);
    }
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
