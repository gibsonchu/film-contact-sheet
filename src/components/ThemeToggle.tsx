"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";
import { IconButton, cx } from "./ui/primitives";

type Theme = "dark" | "light";
const STORAGE_KEY = "fcs-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "light" ? "#f6f4ef" : "#0a0a0b");
}

/**
 * Sun and moon, one button — the icon shown is the mode a click switches
 * to, not the mode you're in, so "sun" reads as an invitation to bring the
 * light up rather than a status readout.
 *
 * Dark is the default and needs no stored preference; only a saved "light"
 * choice does anything, which keeps first-load server and client markup
 * identical and avoids a flash of the wrong theme.
 */
export function ThemeToggle({
  size = "sm",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // Combined into one field so mounting only ever costs a single setState —
  // reading localStorage can't happen during render (no DOM on the server),
  // so this has to live in an effect regardless.
  const [state, setState] = useState<{ theme: Theme; mounted: boolean }>({
    theme: "dark",
    mounted: false,
  });
  const { theme, mounted } = state;

  useEffect(() => {
    // localStorage doesn't exist during the server render, so this can only
    // be read after mount — there's no external subscription to wait on,
    // just a one-time synchronous read of a browser-only API.
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ theme: stored === "light" ? "light" : "dark", mounted: true });
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setState({ theme: next, mounted: true });
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Reserves the same footprint the real button will take, so reading the
  // stored preference after mount never shifts anything around it.
  const box = size === "lg" ? "h-12 w-12" : size === "md" ? "h-9 w-9" : "h-7 w-7";
  if (!mounted) {
    return <span className={cx(box, className)} aria-hidden="true" />;
  }

  return (
    <IconButton
      label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      size={size}
      onClick={toggle}
      className={className}
    >
      {theme === "dark" ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </IconButton>
  );
}
