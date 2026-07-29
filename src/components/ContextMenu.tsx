// Generic right-click context menu, portaled to <body> so it renders above
// everything and isn't clipped by a scrollable ancestor (e.g. the sidebar
// list). Closes on outside click, Escape, or picking an item.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    window.addEventListener("contextmenu", onClose);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("contextmenu", onClose);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="context-menu" style={{ top: y, left: x }} onClick={(e) => e.stopPropagation()}>
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
