// Line one of every brief: `<!-- mr-brief v1 head=<sha> -->`, then the series line if any.
// `head` is the commit the brief describes. It is stamped on attach, so a later push can be
// told apart from the commit the reader is being sent to.

export const MARKER = /<!--\s*mr-brief v1(?:\s+head=([0-9a-f]{7,40}))?\s*-->/;

export function readHead(text) {
  const m = String(text).split("\n")[0].match(MARKER);
  return m ? (m[1] || null) : undefined; // undefined: not a brief · null: a brief with no head
}

export function stampHead(text, sha) {
  const lines = String(text).split("\n");
  if (!MARKER.test(lines[0] ?? "")) throw new Error("not a brief: line one carries no <!-- mr-brief v1 --> marker");
  lines[0] = lines[0].replace(MARKER, `<!-- mr-brief v1 head=${sha.slice(0, 12)} -->`);
  return lines.join("\n");
}

// The brief describes `head`; the MR is at `current`. Short and long shas compare by prefix.
export function isStale(head, current) {
  if (!head || !current) return false;
  const a = head.toLowerCase(), b = current.toLowerCase();
  return !(a.startsWith(b) || b.startsWith(a));
}
