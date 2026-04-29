import localforage from 'localforage';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

interface QueueItem {
  id: string;
  collection: string;
  docId: string;
  payload: any;
  action: 'set' | 'update';
  timestamp: number;
  retryCount: number;
}

export const queueOfflineMutation = async (collectionName: string, docId: string, action: 'set' | 'update', payload: any) => {
  const queue = await localforage.getItem<QueueItem[]>('haefa_retry_queue') || [];
  
  const newItem: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
    collection: collectionName,
    docId,
    payload,
    action,
    timestamp: Date.now(),
    retryCount: 0
  };

  queue.push(newItem);
  await localforage.setItem('haefa_retry_queue', queue);
};

export const getOfflineQueueCount = async (): Promise<number> => {
  const queue = await localforage.getItem<QueueItem[]>('haefa_retry_queue');
  return queue ? queue.length : 0;
};

export const processOfflineQueue = async () => {
  if (!navigator.onLine) return;

  const queue = await localforage.getItem<QueueItem[]>('haefa_retry_queue') || [];
  if (queue.length === 0) return;

  const remainingQueue: QueueItem[] = [];

  for (const item of queue) {
    try {
       const docRef = doc(db, item.collection, item.docId);
       if (item.action === 'set') {
         await setDoc(docRef, item.payload, { merge: true });
       } else {
         await updateDoc(docRef, item.payload);
       }
    } catch (error: any) {
       console.error(`Failed to process queued item ${item.id}`, error);
       if (item.retryCount < 5) {
         // Exponential backoff logic would evaluate item.timestamp and retryCount here
         item.retryCount += 1;
         remainingQueue.push(item);
       } else {
         console.error(`Drop queued item ${item.id} after 5 retries`);
       }
    }
  }

  await localforage.setItem('haefa_retry_queue', remainingQueue);
};

// Start background loop
setInterval(() => {
  if (navigator.onLine) {
    processOfflineQueue();
  }
}, 10000); // Check every 10 seconds
