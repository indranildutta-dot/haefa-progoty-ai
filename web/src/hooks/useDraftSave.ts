import { useState, useEffect } from 'react';
import localforage from 'localforage';

export function useDraftSave<T>(storageKey: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadDraft() {
      try {
        const draft = await localforage.getItem<T>(storageKey);
        if (draft) {
          setData(draft);
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadDraft();
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded) return;
    const saveTimer = setTimeout(() => {
      localforage.setItem(storageKey, data).catch(e => console.error('Failed to save draft:', e));
    }, 500); // 500ms debounce
    return () => clearTimeout(saveTimer);
  }, [data, isLoaded, storageKey]);

  const clearDraft = async () => {
    await localforage.removeItem(storageKey);
    setData(initialValue);
  };

  return { data, setData, isLoaded, clearDraft };
}
