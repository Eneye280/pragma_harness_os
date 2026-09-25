import type { ExplorerFile } from "@shared/explorer";
import { cn } from "../lib/cn";
import { tokenizeCode, type CodeTokenKind } from "./code-tokens";
import { IconClose } from "../components/icons";

const TOKEN_COLOR: Record<CodeTokenKind, string> = {
  plain: "text-zinc-300",
  comment: "text-zinc-600 italic",
  string: "text-emerald-400",
  keyword: "text-harness-soft",
  number: "text-amber-400",
};

interface CodePreviewProps {
  file: ExplorerFile | null;
  onClose: () => void;
}

export function CodePreview({ file, onClose }: CodePreviewProps): React.ReactElement {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-zinc-600">Selecciona un archivo en el Explorer</div>
    );
  }

  const lines = tokenizeCode(file.content, file.language);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="truncate font-mono text-[12px] text-zinc-300">{file.path}</span>
        <span className="rounded-full bg-zinc-800 px-1.5 py-[1px] text-[10px] text-zinc-400">{file.language}</span>
        <span className="text-[10px] text-zinc-600">{lines.length} líneas</span>
        {file.truncated ? <span className="text-[10px] text-amber-400">truncado</span> : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar preview"
          className="ml-auto rounded-control p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <IconClose width={13} height={13} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {file.binary ? (
          <div className="p-4 text-[12px] text-zinc-500">Archivo binario — sin preview de texto.</div>
        ) : (
          <pre className="min-w-full py-2 font-mono text-[12px] leading-[1.55]">
            <code className="block">
              {lines.map((tokens, lineIndex) => (
                <span key={lineIndex} className="flex">
                  <span className="sticky left-0 w-12 shrink-0 select-none bg-surface pr-3 text-right text-zinc-700">
                    {lineIndex + 1}
                  </span>
                  <span className="flex-1 whitespace-pre pr-4">
                    {tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} className={TOKEN_COLOR[token.kind]}>
                        {token.text}
                      </span>
                    ))}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
