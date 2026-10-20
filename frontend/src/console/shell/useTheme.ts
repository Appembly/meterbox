"use client";

import { useCallback, useEffect, useState } from "react";

/** Shares the classic console's theme storage (`mbx.theme` + `html.dark`) so both UIs stay in sync. */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    const apply = () => {
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("mbx.theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      setDark(next);
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (doc.startViewTransition && !reduced) doc.startViewTransition(apply);
    else apply();
  }, []);

  return { dark, toggle };
}
