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
    // Root layout initialized the attribute before paint. Do not reset it on remount.
    window.dispatchEvent(new Event(themeEvent));
    const onStorage = (event) => {
      if (event.key === "cipherbrief-theme" && ["dark", "light"].includes(event.newValue)) {
        document.documentElement.dataset.theme = event.newValue;
        document.documentElement.style.colorScheme = event.newValue;
        window.dispatchEvent(new Event(themeEvent));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
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
