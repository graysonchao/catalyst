import Editor from "@monaco-editor/react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function JsonEditor({ value, onChange, readOnly = false }: JsonEditorProps) {
  return (
    <div className="monaco-container flex-1">
      <Editor
        defaultLanguage="json"
        value={value}
        onChange={(value) => onChange(value || "")}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          folding: true,
          foldingHighlight: true,
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
