import { useCallback } from "react";
import { playClickSound } from "./useGameSounds";

export const useButtonClick = <Args extends unknown[], Return>(
  onClick?: (...args: Args) => Return
) => {
  return useCallback(
    (...args: Args): Return => {
      playClickSound();
      return onClick?.(...args) as Return;
    },
    [onClick]
  );
};
