"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const themeEvent = "cipherbrief-theme-change";

function subscribeToTheme(onChange) {
  window.addEventListener(themeEvent, onChange);
  return () => window.removeEventListener(themeEvent, onChange);
}

function getThemeSnapshot() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "light");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    try {
      const savedTheme = window.localStorage.getItem("cipherbrief-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        initialTheme = savedTheme;
      }
    } catch {
      // Use the system preference when browser storage is unavailable.
    }

    document.documentElement.dataset.theme = initialTheme;
    window.dispatchEvent(new Event(themeEvent));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.dispatchEvent(new Event(themeEvent));

    try {
      window.localStorage.setItem("cipherbrief-theme", nextTheme);
      setNotice(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
    } catch {
      setNotice("Theme changed for this visit; browser storage is unavailable.");
    }
  }

  return (
    <>
      <button
        className="icon-button theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      {notice && (
        <div className="toast toast-top toast-end theme-toast">
          <div className="alert" role="status">{notice}</div>
        </div>
      )}
    </>
  );
}
