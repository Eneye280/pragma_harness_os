import { useState } from "react";
import { tokenizeCode } from "../explorer/code-tokens";
import { cn } from "../lib/cn";
import { TOKEN_CLASS, codeBlockLabel, diffTone, sanitizeLang } from "./code-block";

const DIFF_CLASS: Record<ReturnType<typeof diffTone>, string> = {
  add: "diff-add border-l-2 border-l-emerald-500/70",
  remove: "diff-remove border-l-2 border-l-red-500/70",
  meta: "text-zinc-500",
  none: "",
};

export function CodeBlock({ lang, content }: { lang: string; content: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const language = sanitizeLang(lang);
  const lines = tokenizeCode(content, language);
  const rawLines = content.split("\n");

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
      <figcaption className="flex items-center gap-2 border-b border-hairline bg-surface-raised/60 px-3 py-1.5">
        <span className="text-[12px] tracking-label text-zinc-500">{codeBlockLabel(lang)}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copiado" : "Copiar código"}
          className="ml-auto rounded-control border border-hairline px-2 py-[2px] text-[12px] text-zinc-400 transition-colors hover:bg-surface-raised"
        >
          {copied ? "copiado" : "copiar"}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed">
        <code>
          {lines.map((tokens, lineIndex) => (
            <span key={lineIndex} className={cn("block whitespace-pre", DIFF_CLASS[diffTone(rawLines[lineIndex] ?? "", language)])}>
              {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
