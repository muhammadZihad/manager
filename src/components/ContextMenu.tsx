// Generic right-click menu, portaled to <body> so it renders above everything
// and isn't clipped by a scrollable ancestor (the sidebar list, for one).
//
// Closes on outside click, another right-click, Escape, scroll, or window blur.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ContextMenuAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Right-aligned shortcut hint, e.g. "⌘C". */
  hint?: string;
};

export type ContextMenuEntry = ContextMenuAction | { separator: true };

type Props = {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
};

const MARGIN = 6;

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Flip/clamp before paint so the menu never appears off-screen, which is easy
  // to hit right-clicking near the bottom of the sidebar.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + width + MARGIN > window.innerWidth) left = Math.max(MARGIN, x - width);
    if (top + height + MARGIN > window.innerHeight) top = Math.max(MARGIN, y - height);
    setPos({ left, top });
  }, [x, y, items]);

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    // Capture phase: scrolling happens on inner containers, not window.
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        "separator" in item ? (
          <span key={`sep-${i}`} className="context-menu__separator" />
        ) : (
          <button
            key={item.label + i}
            type="button"
            className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon ? <span className="context-menu__icon">{item.icon}</span> : null}
            <span className="context-menu__label">{item.label}</span>
            {item.hint ? <span className="context-menu__hint">{item.hint}</span> : null}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
