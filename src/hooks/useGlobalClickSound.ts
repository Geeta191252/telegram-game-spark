import { useEffect, useRef } from "react";
import { playClickSound } from "./useGameSounds";

const isClickable = (el: HTMLElement): boolean => {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  return (
    tag === "button" ||
    tag === "a" ||
    role === "button" ||
    role === "link" ||
    el.classList.contains("click-sound") ||
    el.closest("button") !== null ||
    el.closest("[role='button']") !== null ||
    el.closest("a") !== null
  );
};

export const useGlobalClickSound = () => {
  const lastPlayedRef = useRef(0);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const target = (e.target as HTMLElement) || null;
      if (!target) return;
      if (!isClickable(target)) return;
      // Debounce: avoid double chirps from rapid taps or touch+mouse
      const now = Date.now();
      if (now - lastPlayedRef.current < 50) return;
      lastPlayedRef.current = now;
      try {
        playClickSound();
      } catch {
        // ignore audio context errors
      }
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
};
