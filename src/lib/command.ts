// Splits a full shell command string (as typed by the user, e.g. `npm run dev`
// or `claude --dangerously-skip-permissions`) into a program + args, since the
// PTY backend still spawns via a separate program/args pair. Supports simple
// single/double-quoted segments so paths or args with spaces can be quoted.

export function parseCommand(input: string): { program?: string; args: string[] } {
  const [program, ...args] = splitShellWords(input.trim());
  return { program, args };
}

function splitShellWords(input: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) words.push(current);
  return words;
}
