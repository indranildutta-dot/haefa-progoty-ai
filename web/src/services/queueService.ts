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
  onSnapshot,
  deleteDoc,
  setDoc,
  or,
  and
} from "firebase/firestore";
import { db } from "../firebase";
import { QueueItem, EncounterStatus } from "../types";
import { getSession } from "../utils/session";
import { logAction } from "./auditService";
import { updateMetrics } from "./metricsService";
import { handleFirestoreError, OperationType } from "../utils/firestoreError";

const QUEUE_ACTIVE_COLLECTION = "queues_active";
const QUEUE_ARCHIVE_COLLECTION = "queues_archive";

export const addToQueue = async (queueData: Omit<QueueItem, 'id' | 'created_at' | 'country_id' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  console.log(`Adding patient ${queueData.patient_id} to queue for clinic ${selectedClinic.id}...`);

  let docRef;
  try {
    const data = {
      ...queueData,
      country_id: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      station_entry_at: serverTimestamp()
    };
    console.log("Queue item data to add:", data);
    docRef = await addDoc(collection(db, QUEUE_ACTIVE_COLLECTION), data);
    console.log(`Queue item created with ID: ${docRef.id}`);
  } catch (e) {
    console.error("Error adding to queue:", e);
    handleFirestoreError(e, OperationType.WRITE, QUEUE_ACTIVE_COLLECTION);
    throw e;
  }

  try {
    await updateMetrics(selectedClinic.id, selectedCountry.id, {
      active_queue: 1
    });
    console.log("Metrics updated for queue addition.");
  } catch (e) {
    console.error("Failed to update metrics for queue addition, but continuing...", e);
  }

  return docRef.id;
};

export const callNextPatient = async (queueId: string, doctorId: string) => {
  const docRef = doc(db, QUEUE_ACTIVE_COLLECTION, queueId);
  const docSnap = await getDoc(docRef);
  
  await updateDoc(docRef, { 
    status: 'IN_CONSULTATION',
    station: 'doctor',
    doctor_id: doctorId,
    doctor_called_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  if (docSnap.exists()) {
    const data = docSnap.data();
    await logAction({
      action: 'DOCTOR_CALLED_PATIENT',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });
    await logAction({
      action: 'ENCOUNTER_STATUS_CHANGED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });

    await updateMetrics(data.clinic_id, data.country_id, {
      in_consultation: 1
    });
  }
};

export const updateQueueStatus = async (queueId: string, status: EncounterStatus) => {
  const docRef = doc(db, QUEUE_ACTIVE_COLLECTION, queueId);
  const docSnap = await getDoc(docRef);
  
  let station = 'registration';
  if (status.startsWith('WAITING_FOR_VITALS')) station = 'vitals';
  else if (status === 'READY_FOR_DOCTOR' || status === 'IN_CONSULTATION') station = 'doctor';
  else if (status === 'WAITING_FOR_PHARMACY') station = 'pharmacy';
  else if (status === 'COMPLETED') station = 'completed';

  if (docSnap.exists()) {
    const data = docSnap.data();
    
    if (status === 'COMPLETED') {
      // Move to archive
      const archiveRef = doc(db, QUEUE_ARCHIVE_COLLECTION, queueId);
      await setDoc(archiveRef, {
        ...data,
        status,
        station,
        updated_at: serverTimestamp()
      });
      await deleteDoc(docRef);
    } else {
      await updateDoc(docRef, { 
        status, 
        station,
        updated_at: serverTimestamp(),
        station_entry_at: serverTimestamp()
      });
    }

    await logAction({
      action: 'ENCOUNTER_STATUS_CHANGED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });

    if (status === 'COMPLETED') {
      const waitMinutes = data.created_at ? Math.floor((Date.now() - data.created_at.toMillis()) / 60000) : 0;
      await updateMetrics(data.clinic_id, data.country_id, {
        active_queue: -1,
        completed_today: 1,
        wait_time_minutes: waitMinutes
      });
      if (data.status === 'IN_CONSULTATION') {
        await updateMetrics(data.clinic_id, data.country_id, {
          in_consultation: -1
        });
      }
    } else if (data.status === 'IN_CONSULTATION' && status !== 'IN_CONSULTATION') {
      await updateMetrics(data.clinic_id, data.country_id, {
        in_consultation: -1
      });
    }
  }
};

export const updateQueueTriage = async (queueId: string, triageData: Partial<QueueItem>) => {
  const docRef = doc(db, QUEUE_ACTIVE_COLLECTION, queueId);
  await updateDoc(docRef, {
    ...triageData,
    updated_at: serverTimestamp()
  });
};

export const getQueueByStatus = async (status: EncounterStatus) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  const q = query(
    collection(db, QUEUE_ACTIVE_COLLECTION),
    and(
      where("country_id", "==", selectedCountry.id),
      where("clinic_id", "==", selectedClinic.id)
    )
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

export const cancelQueueItem = async (queueId: string, reason: string) => {
  const docRef = doc(db, QUEUE_ACTIVE_COLLECTION, queueId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    
    // Move to archive with CANCELLED status
    const archiveRef = doc(db, QUEUE_ARCHIVE_COLLECTION, queueId);
    await setDoc(archiveRef, {
      ...data,
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    
    await deleteDoc(docRef);

    await logAction({
      action: 'ENCOUNTER_CANCELLED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id,
      metadata: { reason }
    });

    await updateMetrics(data.clinic_id, data.country_id, {
      active_queue: -1
    });
    
    if (data.status === 'IN_CONSULTATION') {
      await updateMetrics(data.clinic_id, data.country_id, {
        in_consultation: -1
      });
    }
  }
};

export const subscribeToQueue = (
  status: EncounterStatus | EncounterStatus[], 
  callback: (items: QueueItem[]) => void,
  onError?: (error: any) => void
) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  const q = query(
    collection(db, QUEUE_ACTIVE_COLLECTION),
    and(
      where("country_id", "==", selectedCountry.id),
      where("clinic_id", "==", selectedClinic.id)
    )
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QueueItem[];

    const statuses = Array.isArray(status) ? status : [status];

    const filtered = items
      .filter(item => statuses.includes(item.status as EncounterStatus))
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
  }, (error) => {
    if (onError) {
      onError(error);
    } else {
      handleFirestoreError(error, OperationType.GET, QUEUE_ACTIVE_COLLECTION);
    }
  });
};
