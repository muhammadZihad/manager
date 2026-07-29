// Modal shown from the Commands section: scans the project directory for
// package.json scripts / Makefile targets and lets the user pick which ones
// to import as Commands, instead of retyping each one by hand.

import { useEffect, useState } from "react";
import { detectImportableCommands, type ImportCandidate } from "../lib/import";

type Props = {
  directory: string;
  onImport: (candidates: ImportCandidate[]) => void;
  onClose: () => void;
};

export function ImportPanel({ directory, onImport, onClose }: Props) {
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    detectImportableCommands(directory)
      .then((found) => {
        if (cancelled) return;
        setCandidates(found);
        setSelected(new Set(found.map((_, i) => i)));
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [directory]);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Import Commands</h2>

        {candidates === null && <p className="modal__hint">Scanning {directory}…</p>}

        {candidates?.length === 0 && (
          <p className="modal__hint">No package.json scripts or Makefile targets found here.</p>
        )}

        {candidates && candidates.length > 0 && (
          <div className="modal__list">
            {candidates.map((c, i) => (
              <label key={i} className="modal__row">
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                <span className="modal__row-name">{c.name}</span>
                <span className="modal__row-command">{c.command}</span>
                <span className="modal__row-source">{c.source}</span>
              </label>
            ))}
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {candidates && candidates.length > 0 ? "Cancel" : "Close"}
          </button>
          {candidates && candidates.length > 0 && (
            <button
              type="button"
              className="btn-accent"
              disabled={selected.size === 0}
              onClick={() => onImport(candidates.filter((_, i) => selected.has(i)))}
            >
              Import{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
