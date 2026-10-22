/**
 * Safe extraction of text from an OpenAI/OpenRouter/custom chat completion
 * message. Providers vary wildly: `content` may be a string, `null`, an array
 * of multimodal parts (`[{ type: "text", text: "…" }]`), and reasoning models
 * (DeepSeek, o-series) put the answer in `reasoning_content`. A missing or
 * unexpected shape must NEVER surface as a `.trim()`/`.replace()` TypeError, so
 * every caller reads through this helper first.
 */

type ChatPart = { text?: unknown } | string | null | undefined;

export type ChatMessageLike = {
  content?: unknown;
  reasoning_content?: unknown;
  text?: unknown;
} | null | undefined;

export function contentText(message: unknown): string {
  const msg = message as ChatMessageLike;
  const content = msg?.content;

  if (typeof content === "string" && content.trim()) return content;

  if (Array.isArray(content)) {
    const joined = content
      .map((part: ChatPart) => {
        if (typeof part === "string") return part;
        const text = part && typeof part === "object" ? (part as { text?: unknown }).text : undefined;
        return typeof text === "string" ? text : "";
      })
      .join("");
    if (joined.trim()) return joined;
  }

  const reasoning = msg?.reasoning_content;
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning;

  const legacy = msg?.text;
  if (typeof legacy === "string" && legacy.trim()) return legacy;

  // Nothing usable: return the (possibly empty) string content rather than
  // undefined so downstream parsing stays on the string path.
  return typeof content === "string" ? content : "";
}
