// A real xterm.js instance rendering canned output, so the terminal settings
// preview is genuinely accurate rather than an approximation in HTML — the same
// renderer, font metrics and palette a live session would use.
//
// No PTY is attached: input is ignored and nothing is spawned.

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { getColorProfile } from "../lib/colorProfiles";
import type { CursorStyle } from "../types";

type Props = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  colorProfile: string;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
};

// ANSI-coloured sample covering the palette slots people actually notice:
// prompt, paths, success, warning, error, dim detail, and a bright accent.
const SAMPLE = [
  "\x1b[32m➜\x1b[0m  \x1b[36macme-storefront\x1b[0m \x1b[90mgit:(\x1b[31mmain\x1b[90m)\x1b[0m npm run dev",
  "",
  "\x1b[90m> acme-storefront@1.4.0 dev\x1b[0m",
  "\x1b[90m> vite\x1b[0m",
  "",
  "  \x1b[1mVITE\x1b[0m \x1b[90mv7.3.6\x1b[0m  ready in \x1b[32m142 ms\x1b[0m",
  "",
  "  \x1b[32m➜\x1b[0m  \x1b[1mLocal\x1b[0m:   \x1b[36mhttp://localhost:5173/\x1b[0m",
  "  \x1b[32m➜\x1b[0m  \x1b[1mNetwork\x1b[0m: \x1b[90muse --host to expose\x1b[0m",
  "",
  "\x1b[33m⚠\x1b[0m  \x1b[33m2 packages need attention\x1b[0m",
  "\x1b[31m✖\x1b[0m  \x1b[31merror\x1b[0m \x1b[90msrc/lib/pricing.ts:42\x1b[0m",
  "",
  "\x1b[34mblue\x1b[0m \x1b[35mmagenta\x1b[0m \x1b[36mcyan\x1b[0m \x1b[37mwhite\x1b[0m \x1b[91mbright\x1b[0m \x1b[92mansi\x1b[0m \x1b[93mpalette\x1b[0m",
  "",
  "\x1b[32m➜\x1b[0m  ",
].join("\r\n");

export function TerminalPreview({
  fontFamily,
  fontSize,
  lineHeight,
  colorProfile,
  cursorStyle,
  cursorBlink,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Rebuilt on every settings change: xterm recalculates glyph metrics from
  // scratch, which is exactly what makes the preview trustworthy.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      fontFamily,
      fontSize,
      lineHeight,
      cursorStyle,
      cursorBlink,
      theme: getColorProfile(colorProfile).theme,
      // Fixed geometry keeps the preview box a predictable size, and there's no
      // PTY to inform of a resize anyway.
      cols: 64,
      rows: 16,
      scrollback: 0,
      disableStdin: true,
      convertEol: true,
    });

    term.open(container);
    term.write(SAMPLE);

    return () => term.dispose();
  }, [fontFamily, fontSize, lineHeight, colorProfile, cursorStyle, cursorBlink]);

  return <div className="terminal-preview" ref={containerRef} />;
}
