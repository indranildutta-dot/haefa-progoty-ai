import { useEffect } from 'react';

export function useFormAutoSave<T>(formKey: string, data: T, setData: (data: T) => void, enabled: boolean = true) {
  // Load data on initial mount
  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = localStorage.getItem(formKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed);
      }
    } catch (e) {
      console.warn(`[AutoSave] Error restoring form data for ${formKey}:`, e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Save data when it changes
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(formKey, JSON.stringify(data));
      } catch (e) {
        console.warn(`[AutoSave] Error saving form data for ${formKey}:`, e);
      }
    }, 2000); // 2s debounce

    return () => clearTimeout(timer);
  }, [data, formKey, enabled]);

  const clearSavedData = () => {
    try {
      localStorage.removeItem(formKey);
    } catch (e) {
      console.warn(`[AutoSave] Error clearing form data for ${formKey}:`, e);
    }
  };

  return { clearSavedData };
}
