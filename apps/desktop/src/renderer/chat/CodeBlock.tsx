import { useState } from "react";
import { tokenizeCode } from "../explorer/code-tokens";
import { cn } from "../lib/cn";
import { TOKEN_CLASS, codeBlockLabel, diffTone, isDiffLanguage, sanitizeLang } from "./code-block";

const DIFF_CLASS: Record<ReturnType<typeof diffTone>, string> = {
  add: "diff-add border-l-2 border-l-emerald-500/70",
  remove: "diff-remove border-l-2 border-l-red-500/70",
  meta: "text-zinc-500",
  none: "",
};

const COLLAPSE_THRESHOLD = 24;

export function CodeBlock({ lang, content }: { lang: string; content: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const language = sanitizeLang(lang);
  const lines = tokenizeCode(content, language);
  const rawLines = content.split("\n");
  const collapsible = rawLines.length > COLLAPSE_THRESHOLD;
  const visible = collapsible && !expanded ? lines.slice(0, COLLAPSE_THRESHOLD) : lines;
  const gutterWidth = Math.max(2, String(lines.length).length);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <figure className="overflow-hidden rounded-control border border-hairline bg-[#141418]">
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-raised/60 px-3 py-1.5">
        <span className="text-[12px] tracking-label text-zinc-500">{codeBlockLabel(lang)}</span>
        {isDiffLanguage(language) ? (
          <span className="rounded-pill bg-surface-raised px-1.5 text-[12px] text-zinc-500">diff</span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWrap((value) => !value)}
            aria-pressed={wrap}
            title={wrap ? "Quitar ajuste de línea" : "Ajustar líneas largas"}
            className="rounded-control border border-hairline px-2 py-[2px] text-[12px] text-zinc-400 transition-colors hover:bg-surface-raised"
          >
            {wrap ? "sin ajuste" : "ajustar"}
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? "Copiado" : "Copiar código"}
            className="rounded-control border border-hairline px-2 py-[2px] text-[12px] text-zinc-400 transition-colors hover:bg-surface-raised"
          >
            {copied ? "copiado" : "copiar"}
          </button>
        </span>
      </figcaption>

      <pre className="max-h-[520px] overflow-auto p-3 font-mono text-[12px] leading-relaxed">
        <code className="block">
          {visible.map((tokens, lineIndex) => (
            <span
              key={lineIndex}
              className={cn(
                "block",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                DIFF_CLASS[diffTone(rawLines[lineIndex] ?? "", language)],
              )}
            >
              <span
                aria-hidden="true"
                className="mr-3 inline-block select-none text-right text-zinc-600"
                style={{ width: `${gutterWidth}ch` }}
              >
                {lineIndex + 1}
              </span>
              {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>

      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="block w-full border-t border-hairline bg-surface-raised/40 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {expanded ? "Contraer" : `Expandir ${lines.length - COLLAPSE_THRESHOLD} líneas más`}
        </button>
      ) : null}
    </figure>
  );
}
