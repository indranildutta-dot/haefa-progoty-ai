import { useEffect, useRef, useState } from 'react';
import { QueueItem } from '../types';

export const useQueueNotifier = (queueItems: any[]) => {
  const [newArrivalIds, setNewArrivalIds] = useState<string[]>([]);
  const prevQueueRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only track if we actually have items and it's not the initial load
    const currentIds = new Set(queueItems.map(item => (item.queueId || item.id)));
    const prevIds = prevQueueRef.current;
    
    if (prevIds.size > 0 && currentIds.size > 0) {
      const newlyAdded = queueItems
        .filter(item => !prevIds.has(item.queueId || item.id))
        .map(item => item.queueId || item.id);
      
      if (newlyAdded.length > 0) {
        // Play soft chime
        try {
           const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
           const osc = ctx.createOscillator();
           const gain = ctx.createGain();
           osc.connect(gain);
           gain.connect(ctx.destination);
           osc.type = 'sine';
           osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
           osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
           gain.gain.setValueAtTime(0.1, ctx.currentTime);
           gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
           osc.start();
           osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
           console.warn("Audio Context not supported or allowed", e);
        }

        // Visually flash
        setNewArrivalIds(newlyAdded);
        const timer = setTimeout(() => setNewArrivalIds([]), 3000);
        return () => clearTimeout(timer);
      }
    }
    
    prevQueueRef.current = currentIds;
  }, [queueItems]);

  return { newArrivalIds };
};
