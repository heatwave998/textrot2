
import { useEffect, useCallback, useState } from 'react';

export type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

export type KeyboardShortcut = {
  id: string;
  combo: KeyCombo;
  action: (e: KeyboardEvent) => void;
};

export const useKeyboard = (shortcuts: KeyboardShortcut[]) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore inputs, textareas, and contentEditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        const { key, ctrl, shift, alt } = shortcut.combo;

        const keyMatch = e.key.toLowerCase() === key.toLowerCase();
        // Treat meta (Command on Mac) as equivalent to Ctrl for standard shortcuts
        const ctrlMatch = !!ctrl === (e.ctrlKey || e.metaKey); 
        const shiftMatch = !!shift === e.shiftKey;
        const altMatch = !!alt === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action(e);
        }
      });
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Hook to return boolean indicating if a specific key is currently held down.
 */
export const useIsKeyPressed = (targetKey: string): boolean => {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      if (e.key === targetKey) {
        setIsPressed(true);
      }
    };

    const upHandler = (e: KeyboardEvent) => {
      if (e.key === targetKey) {
        setIsPressed(false);
      }
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);

  return isPressed;
};
