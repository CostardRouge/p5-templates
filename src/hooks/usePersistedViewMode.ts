import { useState, useEffect } from "react";

type ViewMode = "grid" | "list" | "table" | "cards";

/**
 * Custom hook to persist view mode preference in localStorage
 * Handles errors gracefully and prevents hydration mismatch by using useEffect
 * 
 * @param storageKey - The localStorage key to use for persistence
 * @param defaultValue - The default view mode if nothing is stored
 * @returns [viewMode, setViewMode] tuple
 */
export function usePersistedViewMode<T extends ViewMode>(
  storageKey: string,
  defaultValue: T
): [T, (value: T) => void] {
  // Always start with default value for SSR/hydration
  const [viewMode, setViewModeState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after hydration to prevent mismatch
  useEffect(() => {
    setIsHydrated(true);
    
    try {
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        // Validate that the stored value is a valid view mode
        const parsed = JSON.parse(stored) as T;
        
        // Type guard to ensure the value is valid
        if (typeof parsed === "string" && 
            (parsed === "grid" || parsed === "list" || parsed === "table" || parsed === "cards")) {
          setViewModeState(parsed);
        }
      }
    } catch (error) {
      // Silently fail and use default if localStorage is unavailable or corrupted
      console.warn(`Failed to read ${storageKey} from localStorage:`, error);
    }
  }, [storageKey]);

  // Persist to localStorage whenever viewMode changes (but only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(viewMode));
    } catch (error) {
      // Handle quota exceeded or other localStorage errors
      console.warn(`Failed to save ${storageKey} to localStorage:`, error);
    }
  }, [storageKey, viewMode, isHydrated]);

  return [viewMode, setViewModeState];
}
