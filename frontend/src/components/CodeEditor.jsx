import Editor from "@monaco-editor/react";

export default function CodeEditor({ code, onChange }) {
  return (
    <div className="code-editor">
      <Editor
        height="420px"
        defaultLanguage="html"
        theme="vs-dark"
        value={code}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true
        }}
        onChange={(value) => onChange(value || "")}
      />
    </div>
  );
}
