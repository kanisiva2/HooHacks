"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CodePanelProps = {
  filePath?: string;
  fileContent?: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  isLoading?: boolean;
};

function languageFromPath(path?: string) {
  if (!path) return "plaintext";
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "java":
      return "java";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "sh":
      return "shell";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
}

export function CodePanel({
  filePath,
  fileContent,
  lineStart,
  lineEnd,
  isLoading,
}: CodePanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const language = useMemo(() => languageFromPath(filePath), [filePath]);

  const applyHighlights = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      const model = editorInstance.getModel();
      if (!model) {
        return;
      }

      const maxLine = model.getLineCount();
      const start = lineStart ?? null;
      const end = lineEnd ?? null;

      if (!start || !end || start < 1 || end < start) {
        decorationsRef.current = editorInstance.deltaDecorations(decorationsRef.current, []);
        return;
      }

      const safeStart = Math.min(start, maxLine);
      const safeEnd = Math.min(end, maxLine);
      decorationsRef.current = editorInstance.deltaDecorations(decorationsRef.current, [
        {
          range: {
            startLineNumber: safeStart,
            startColumn: 1,
            endLineNumber: safeEnd,
            endColumn: model.getLineMaxColumn(safeEnd),
          },
          options: {
            isWholeLine: true,
            className: "bg-red-500/15",
            linesDecorationsClassName: "border-l-2 border-red-500",
          },
        },
      ]);

      editorInstance.revealLineInCenter(safeStart);
    },
    [lineStart, lineEnd],
  );

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    applyHighlights(editorRef.current);
  }, [applyHighlights, fileContent]);

  if (!filePath) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a suspect file to inspect full source.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <MonacoEditor
      height="100%"
      language={language}
      theme="vs-dark"
      value={fileContent ?? ""}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
      }}
      onMount={(editorInstance) => {
        editorRef.current = editorInstance;
        applyHighlights(editorInstance);
      }}
    />
  );
}
