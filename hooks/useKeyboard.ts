
import { useEffect, useCallback, useState } from 'react';

export type KeyCombo = {
  key?: string;
  code?: string;
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
        const { key, code, ctrl, shift, alt, meta } = shortcut.combo;

        // Check Key (Character) match if provided
        const keyMatch = key ? e.key.toLowerCase() === key.toLowerCase() : true;
        
        // Check Code (Physical Key) match if provided (e.g., 'Digit1')
        const codeMatch = code ? e.code === code : true;

        // Ensure at least one identifier was provided and matched
        if (!key && !code) return;
        if (!keyMatch || !codeMatch) return;

        // Check Modifiers
        const ctrlMatch = !!ctrl === (e.ctrlKey || e.metaKey); // Treat meta as ctrl on Mac often, or explicit meta
        // If meta is explicitly requested, check it strictly, otherwise fallback to standard ctrl/meta alias behavior
        const metaStrictMatch = meta !== undefined ? !!meta === e.metaKey : true;
        
        const shiftMatch = !!shift === e.shiftKey;
        const altMatch = !!alt === e.altKey;

        if (ctrlMatch && shiftMatch && altMatch && metaStrictMatch) {
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
