// Terminal colour profiles. Each is a full xterm.js ITheme — background,
// foreground, cursor, selection and the 16 ANSI slots — so switching profile
// changes every colour a program can emit, not just the background.
//
// `swatch` is the subset shown in the settings picker preview chips.

export type ColorProfile = {
  id: string;
  name: string;
  /** true when the palette is designed for a light background. */
  light?: boolean;
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
};

export const COLOR_PROFILES: ColorProfile[] = [
  {
    id: "manager-dark",
    name: "Manager Dark",
    theme: {
      background: "#181a20",
      foreground: "#e4e6eb",
      cursor: "#2ee6a6",
      cursorAccent: "#181a20",
      selectionBackground: "#2ee6a655",
      black: "#1b1d24",
      red: "#ef5a5a",
      green: "#2ee6a6",
      yellow: "#e6b02e",
      blue: "#4aa3f0",
      magenta: "#b48ef0",
      cyan: "#3fd4d4",
      white: "#c9ccd3",
      brightBlack: "#6b6f7a",
      brightRed: "#ff7b7b",
      brightGreen: "#68f7c4",
      brightYellow: "#f5c95a",
      brightBlue: "#79c0ff",
      brightMagenta: "#d0b0ff",
      brightCyan: "#7ceaea",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "manager-light",
    name: "Manager Light",
    light: true,
    theme: {
      background: "#ffffff",
      foreground: "#1b1d24",
      cursor: "#12a874",
      cursorAccent: "#ffffff",
      selectionBackground: "#12a87433",
      black: "#1b1d24",
      red: "#c62b2b",
      green: "#0d7d57",
      yellow: "#9a6b00",
      blue: "#1a63b8",
      magenta: "#7d3fb8",
      cyan: "#17868a",
      white: "#5b616d",
      brightBlack: "#8b909b",
      brightRed: "#e04444",
      brightGreen: "#12a874",
      brightYellow: "#c08a00",
      brightBlue: "#2d7fd8",
      brightMagenta: "#9a5ed8",
      brightCyan: "#1fa3a8",
      brightWhite: "#1b1d24",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    theme: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
      cursorAccent: "#282a36",
      selectionBackground: "#44475a",
      black: "#21222c",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#bd93f9",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#f8f8f2",
      brightBlack: "#6272a4",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92df",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "nord",
    name: "Nord",
    theme: {
      background: "#2e3440",
      foreground: "#d8dee9",
      cursor: "#d8dee9",
      cursorAccent: "#2e3440",
      selectionBackground: "#434c5e",
      black: "#3b4252",
      red: "#bf616a",
      green: "#a3be8c",
      yellow: "#ebcb8b",
      blue: "#81a1c1",
      magenta: "#b48ead",
      cyan: "#88c0d0",
      white: "#e5e9f0",
      brightBlack: "#4c566a",
      brightRed: "#bf616a",
      brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b",
      brightBlue: "#81a1c1",
      brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb",
      brightWhite: "#eceff4",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    theme: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#93a1a1",
      cursorAccent: "#002b36",
      selectionBackground: "#073642",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#586e75",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    theme: {
      background: "#282c34",
      foreground: "#abb2bf",
      cursor: "#528bff",
      cursorAccent: "#282c34",
      selectionBackground: "#3e4451",
      black: "#282c34",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#abb2bf",
      brightBlack: "#5c6370",
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    theme: {
      background: "#282828",
      foreground: "#ebdbb2",
      cursor: "#ebdbb2",
      cursorAccent: "#282828",
      selectionBackground: "#504945",
      black: "#282828",
      red: "#cc241d",
      green: "#98971a",
      yellow: "#d79921",
      blue: "#458588",
      magenta: "#b16286",
      cyan: "#689d6a",
      white: "#a89984",
      brightBlack: "#928374",
      brightRed: "#fb4934",
      brightGreen: "#b8bb26",
      brightYellow: "#fabd2f",
      brightBlue: "#83a598",
      brightMagenta: "#d3869b",
      brightCyan: "#8ec07c",
      brightWhite: "#ebdbb2",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    theme: {
      background: "#1a1b26",
      foreground: "#c0caf5",
      cursor: "#c0caf5",
      cursorAccent: "#1a1b26",
      selectionBackground: "#33467c",
      black: "#15161e",
      red: "#f7768e",
      green: "#9ece6a",
      yellow: "#e0af68",
      blue: "#7aa2f7",
      magenta: "#bb9af7",
      cyan: "#7dcfff",
      white: "#a9b1d6",
      brightBlack: "#414868",
      brightRed: "#f7768e",
      brightGreen: "#9ece6a",
      brightYellow: "#e0af68",
      brightBlue: "#7aa2f7",
      brightMagenta: "#bb9af7",
      brightCyan: "#7dcfff",
      brightWhite: "#c0caf5",
    },
  },
];

export function getColorProfile(id: string): ColorProfile {
  return COLOR_PROFILES.find((p) => p.id === id) ?? COLOR_PROFILES[0];
}

/** The colours shown as chips in the profile picker. */
export function profileSwatch(profile: ColorProfile): string[] {
  const t = profile.theme;
  return [t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan];
}
