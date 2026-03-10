import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { QueueItem, EncounterStatus } from "../types";
import { useAppStore } from "../store/useAppStore";
import { logAction } from "./auditService";

const QUEUE_COLLECTION = "queue";

export const addToQueue = async (queueData: Omit<QueueItem, 'id' | 'created_at' | 'country_code' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  const docRef = await addDoc(collection(db, QUEUE_COLLECTION), {
    ...queueData,
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });
  return docRef.id;
};

export const updateQueueStatus = async (queueId: string, status: EncounterStatus) => {
  const docRef = doc(db, QUEUE_COLLECTION, queueId);
  const docSnap = await getDoc(docRef);
  
  await updateDoc(docRef, { status });

  if (docSnap.exists()) {
    const data = docSnap.data();
    await logAction({
      action: 'ENCOUNTER_STATUS_CHANGED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });
  }
};

export const updateQueueTriage = async (queueId: string, triageData: Partial<QueueItem>) => {
  const docRef = doc(db, QUEUE_COLLECTION, queueId);
  await updateDoc(docRef, triageData);
};

export const getQueueByStatus = async (status: EncounterStatus) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  const q = query(
    collection(db, QUEUE_COLLECTION),
    where("country_code", "==", selectedCountry.id),
    where("clinic_id", "==", selectedClinic.id)
  );
  
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as QueueItem[];

  return items
    .filter(item => item.status === status)
    .sort((a, b) => {
      const priorityA = a.priority_score || 0;
      const priorityB = b.priority_score || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // DESC
      }
      const timeA = a.created_at?.toMillis() || 0;
      const timeB = b.created_at?.toMillis() || 0;
      return timeA - timeB; // ASC
    });
};

export const subscribeToQueue = (status: EncounterStatus, callback: (items: QueueItem[]) => void) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  const q = query(
    collection(db, QUEUE_COLLECTION),
    where("country_code", "==", selectedCountry.id),
    where("clinic_id", "==", selectedClinic.id)
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QueueItem[];

    const filtered = items
      .filter(item => item.status === status)
      .sort((a, b) => {
        const priorityA = a.priority_score || 0;
        const priorityB = b.priority_score || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // DESC
        }
        const timeA = a.created_at?.toMillis() || 0;
        const timeB = b.created_at?.toMillis() || 0;
        return timeA - timeB; // ASC
      });

    callback(filtered);
  });
};
