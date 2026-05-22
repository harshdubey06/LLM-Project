import { useMemo, useState } from "react";
import PromptPanel from "./components/PromptPanel.jsx";
import CodeEditor from "./components/CodeEditor.jsx";
import LivePreview from "./components/LivePreview.jsx";
import Toolbar from "./components/Toolbar.jsx";
import { generateForm } from "./services/formApi.js";

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

export default function App() {
  const [requirement, setRequirement] = useState("");
  const [outputType, setOutputType] = useState("html");
  const [layoutPreference, setLayoutPreference] = useState("two-column");
  const [code, setCode] = useState(starterCode);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canGenerate = useMemo(() => requirement.trim().length > 0 && !isLoading, [requirement, isLoading]);

  async function handleGenerate() {
    if (!requirement.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await generateForm({ requirement, outputType, layoutPreference });
      setCode(result.code);
    } catch (err) {
      setError(err.message || "Unable to generate form code.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <PromptPanel
          requirement={requirement}
          outputType={outputType}
          layoutPreference={layoutPreference}
          isLoading={isLoading}
          canGenerate={canGenerate}
          error={error}
          onRequirementChange={setRequirement}
          onOutputTypeChange={setOutputType}
          onLayoutPreferenceChange={setLayoutPreference}
          onGenerate={handleGenerate}
        />
        <LivePreview code={code} />
      </section>

      <section className="editor-section">
        <Toolbar code={code} outputType={outputType} onRegenerate={handleGenerate} canRegenerate={canGenerate} />
        <CodeEditor code={code} outputType={outputType} onChange={setCode} />
      </section>
    </main>
  );
}
