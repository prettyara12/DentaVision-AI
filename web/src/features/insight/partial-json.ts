/**
 * Best-effort parse of a JSON document that is still streaming in. Returns the largest valid prefix,
 * closing open brackets and an unfinished string value, or undefined when nothing is usable yet.
 */
export function parsePartialJson(text: string): unknown {
  const stack: ("{" | "[")[] = [];
  let inString = false;
  let escaped = false;
  let isKey = false;
  let expectKey = false;
  // Prefix + closers that are known to form valid JSON (right after a complete value or an opener).
  let safe: string | undefined;

  const closers = () =>
    stack
      .map((c) => (c === "{" ? "}" : "]"))
      .reverse()
      .join("");
  const mark = (end: number) => (safe = text.slice(0, end) + closers());

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') {
        inString = false;
        if (!isKey) mark(i + 1);
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      isKey = stack.at(-1) === "{" && expectKey;
    } else if (c === "{" || c === "[") {
      stack.push(c);
      expectKey = c === "{";
      mark(i + 1);
    } else if (c === "}" || c === "]") {
      stack.pop();
      expectKey = false;
      mark(i + 1);
    } else if (c === ":") expectKey = false;
    else if (c === ",") expectKey = stack.at(-1) === "{";
    // A number or literal is complete only once a delimiter follows it.
    else if (/[\w.+-]/.test(c) && /[\s,}\]]/.test(text[i + 1] ?? "")) mark(i + 1);
  }

  const candidates: string[] = [];
  if (inString && !isKey) {
    // Drop a dangling escape so the closing quote is not swallowed.
    const body = text.replace(escaped ? /\\$/ : /\\u[0-9a-fA-F]{0,3}$/, "");
    candidates.push(`${body}"${closers()}`);
  }
  if (safe !== undefined) candidates.push(safe);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next, shorter candidate
    }
  }
  return undefined;
}
