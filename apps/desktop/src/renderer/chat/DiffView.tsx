interface DiffLine {
  kind: "added" | "removed" | "context";
  text: string;
}

function parseDiff(diff: string): DiffLine[] {
  return diff.split("\n").map((line) => {
    if (line.startsWith("+")) return { kind: "added", text: line.slice(1) };
    if (line.startsWith("-")) return { kind: "removed", text: line.slice(1) };
    return { kind: "context", text: line.startsWith(" ") ? line.slice(1) : line };
  });
}

const LINE_STYLES: Record<DiffLine["kind"], string> = {
  added: "bg-emerald-500/10 text-emerald-300",
  removed: "bg-red-500/10 text-red-300",
  context: "text-zinc-500",
};

const LINE_PREFIX: Record<DiffLine["kind"], string> = {
  added: "+",
  removed: "-",
  context: " ",
};

export function DiffView({ diff }: { diff: string }): React.ReactElement {
  return (
    <pre className="overflow-x-auto rounded-control border border-hairline bg-black/40 py-1 font-mono text-[11.5px] leading-relaxed">
      <code className="block">
        {parseDiff(diff).map((line, index) => (
          <span key={index} className={`block px-3 ${LINE_STYLES[line.kind]}`}>
            <span className="mr-2 select-none opacity-60">{LINE_PREFIX[line.kind]}</span>
            {line.text || " "}
          </span>
        ))}
      </code>
    </pre>
  );
}
