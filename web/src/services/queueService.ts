import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  serverTimestamp,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { QueueItem, EncounterStatus } from "../types";

const QUEUE_COLLECTION = "queue";

export const addToQueue = async (queueData: Omit<QueueItem, 'id' | 'created_at'>) => {
  const docRef = await addDoc(collection(db, QUEUE_COLLECTION), {
    ...queueData,
    created_at: serverTimestamp()
  });
  return docRef.id;
};

export const updateQueueStatus = async (queueId: string, status: EncounterStatus) => {
  const docRef = doc(db, QUEUE_COLLECTION, queueId);
  await updateDoc(docRef, { status });
};

export const getQueueByStatus = async (status: EncounterStatus, countryId: string) => {
  const q = query(
    collection(db, QUEUE_COLLECTION),
    where("countryId", "==", countryId),
    where("status", "==", status),
    orderBy("timestamp", "asc")
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as QueueItem[];
};

export const subscribeToQueue = (status: EncounterStatus, countryId: string, callback: (items: QueueItem[]) => void) => {
  const q = query(
    collection(db, QUEUE_COLLECTION),
    where("countryId", "==", countryId),
    where("status", "==", status),
    orderBy("timestamp", "asc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QueueItem[];
    callback(items);
  });
};
