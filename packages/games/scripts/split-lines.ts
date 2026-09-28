export function splitLines(name: string, raw: string): string[] {
  if (raw.includes("\r")) {
    throw new Error(`${name}: CRLF line endings are not allowed`);
  }
  const trimmed = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  return trimmed.split("\n");
}
