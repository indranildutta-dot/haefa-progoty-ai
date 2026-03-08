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
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { Encounter, Vitals, EncounterStatus, Prescription } from "../types";

const ENCOUNTERS_COLLECTION = "encounters";

export const createEncounter = async (patient_id: string, country_id: string) => {
  const docRef = await addDoc(collection(db, ENCOUNTERS_COLLECTION), {
    patient_id,
    encounter_status: 'registered',
    current_station: 'registration',
    country_id,
    created_at: serverTimestamp()
  });
  return docRef.id;
};

export const updateEncounterVitals = async (encounterId: string, vitals: Vitals) => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  await updateDoc(docRef, {
    vitals,
    status: 'READY_FOR_DOCTOR',
    updatedAt: serverTimestamp()
  });
};

export const getLatestEncounter = async (patientId: string): Promise<Encounter | null> => {
  const q = query(
    collection(db, ENCOUNTERS_COLLECTION),
    where("patientId", "==", patientId),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Encounter;
  }
  return null;
};

export const updateEncounterStatus = async (encounterId: string, status: EncounterStatus) => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp()
  });
};

export const updateEncounterConsultation = async (
  encounterId: string, 
  data: { chiefComplaint: string; diagnosis: string; notes: string; prescriptions: Prescription[] }
) => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  await updateDoc(docRef, {
    ...data,
    status: 'WAITING_FOR_PHARMACY',
    updatedAt: serverTimestamp()
  });
};
