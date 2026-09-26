import { parseMarkdown, tokenizeInline, type InlineToken, type MarkdownBlock } from "./markdown";
import { CodeBlock } from "./CodeBlock";

function renderInlineTokens(tokens: InlineToken[]): React.ReactNode[] {
  return tokens.map((token, index) => {
    switch (token.type) {
      case "code":
        return (
          <code key={index} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[12px] text-harness-soft">
            {token.value}
          </code>
        );
      case "bold":
        return (
          <strong key={index} className="font-semibold text-zinc-100">
            {token.value}
          </strong>
        );
      case "italic":
        return (
          <em key={index} className="italic text-zinc-300">
            {token.value}
          </em>
        );
      default:
        return <span key={index}>{token.value}</span>;
    }
  });
}

const HEADING_SIZES = ["text-base", "text-base", "text-sm", "text-sm", "text-xs", "text-xs"];

function renderBlock(block: MarkdownBlock, index: number): React.ReactNode {
  switch (block.type) {
    case "code":
      return <CodeBlock key={index} lang={block.lang} content={block.content} />;
    case "tool":
      return null;
    case "heading":
      return (
        <p key={index} className={`${HEADING_SIZES[block.level - 1]} font-semibold text-zinc-100`}>
          {renderInlineTokens(tokenizeInline(block.text))}
        </p>
      );
    case "list":
      return block.ordered ? (
        <ol key={index} className="ml-4 list-decimal space-y-1 text-zinc-300">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineTokens(tokenizeInline(item))}</li>
          ))}
        </ol>
      ) : (
        <ul key={index} className="ml-4 list-disc space-y-1 text-zinc-300">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineTokens(tokenizeInline(item))}</li>
          ))}
        </ul>
      );
    default:
      return (
        <p key={index} className="whitespace-pre-wrap leading-relaxed text-zinc-300">
          {renderInlineTokens(tokenizeInline(block.text))}
        </p>
      );
  }
}

export function MarkdownView({ text }: { text: string }): React.ReactElement {
  return <div className="space-y-2 text-[13px]">{parseMarkdown(text).map(renderBlock)}</div>;
}
