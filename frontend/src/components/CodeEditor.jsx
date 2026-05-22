import Editor from "@monaco-editor/react";

export default function CodeEditor({ code, outputType, onChange }) {
  return (
    <div className="code-editor">
      <Editor
        height="420px"
        language={outputType === "react" ? "javascript" : "html"}
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
