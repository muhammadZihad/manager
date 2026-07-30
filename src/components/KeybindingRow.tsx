// One rebindable shortcut. Click the chord to start recording, then press the
// combination you want; Escape cancels and Backspace/Delete unassigns.
//
// While recording, keydown is captured on the window with `capture: true` so
// the global shortcut handler can't act on the very keys being recorded.

import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { comboFromEvent, formatCombo, isReserved } from "../lib/keys";

type Props = {
  label: string;
  hint: string;
  combo: string;
  isDefault: boolean;
  conflicting: boolean;
  onChange: (combo: string) => void;
  onReset: () => void;
};

export function KeybindingRow({
  label,
  hint,
  combo,
  isDefault,
  conflicting,
  onChange,
  onReset,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setWarning(null);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        onChange("");
        setRecording(false);
        setWarning(null);
        return;
      }

      const next = comboFromEvent(e);
      if (!next) return; // modifier held on its own — keep waiting

      // A binding with no modifier would swallow ordinary typing.
      if (!next.includes("Mod") && !next.includes("Alt")) {
        setWarning("Needs a Cmd/Ctrl or Alt modifier");
        return;
      }
      if (isReserved(next)) {
        setWarning(`${formatCombo(next)} is reserved for the shell`);
        return;
      }

      onChange(next);
      setRecording(false);
      setWarning(null);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [recording, onChange]);

  return (
    <div className="keybind-row">
      <div className="keybind-row__text">
        <span className="keybind-row__label">{label}</span>
        <span className="keybind-row__hint">{warning ?? hint}</span>
      </div>

      <button
        type="button"
        className={
          "keybind-row__combo" +
          (recording ? " keybind-row__combo--recording" : "") +
          (conflicting ? " keybind-row__combo--conflict" : "") +
          (warning ? " keybind-row__combo--warning" : "")
        }
        onClick={() => {
          setWarning(null);
          setRecording((v) => !v);
        }}
        title={recording ? "Press a combination — Esc cancels" : "Click to change"}
      >
        {recording ? "Press keys…" : formatCombo(combo)}
      </button>

      <button
        type="button"
        className="keybind-row__icon"
        title="Unassign"
        disabled={!combo}
        onClick={() => onChange("")}
      >
        <X size={13} />
      </button>
      <button
        type="button"
        className="keybind-row__icon"
        title="Reset to default"
        disabled={isDefault}
        onClick={onReset}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}
