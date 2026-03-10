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
import { 
  Encounter, 
  Vitals, 
  EncounterStatus, 
  Prescription, 
  VitalsRecord, 
  DiagnosisRecord, 
  PrescriptionRecord 
} from "../types";
import { useAppStore } from "../store/useAppStore";
import { logAction } from "./auditService";

const ENCOUNTERS_COLLECTION = "encounters";
const VITALS_COLLECTION = "vitals";
const DIAGNOSES_COLLECTION = "diagnoses";
const PRESCRIPTIONS_COLLECTION = "prescriptions";

export const createEncounter = async (patient_id: string) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  const docRef = await addDoc(collection(db, ENCOUNTERS_COLLECTION), {
    patient_id,
    encounter_status: 'WAITING_FOR_VITALS',
    current_station: 'registration',
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });
  return docRef.id;
};

export const getEncounterById = async (encounterId: string): Promise<Encounter | null> => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Encounter;
  }
  return null;
};

export const getLatestEncounter = async (patientId: string): Promise<Encounter | null> => {
  const q = query(
    collection(db, ENCOUNTERS_COLLECTION),
    where("patient_id", "==", patientId)
  );
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;

  const encounters = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Encounter[];

  // Sort on client side to avoid index requirement
  encounters.sort((a, b) => {
    const timeA = a.created_at?.toMillis() || 0;
    const timeB = b.created_at?.toMillis() || 0;
    return timeB - timeA;
  });

  return encounters[0];
};

export const updateEncounterStatus = async (encounterId: string, status: EncounterStatus) => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  const docSnap = await getDoc(docRef);
  const patientId = docSnap.exists() ? docSnap.data().patient_id : undefined;

  await updateDoc(docRef, {
    encounter_status: status,
    updatedAt: serverTimestamp()
  });

  await logAction({
    action: 'ENCOUNTER_STATUS_CHANGED',
    encounter_id: encounterId,
    patient_id: patientId
  });
};

export const saveVitals = async (vitalsData: Omit<VitalsRecord, 'id' | 'created_at' | 'country_code' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  await addDoc(collection(db, VITALS_COLLECTION), {
    ...vitalsData,
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });
  
  const encounterRef = doc(db, ENCOUNTERS_COLLECTION, vitalsData.encounter_id);
  await updateDoc(encounterRef, {
    encounter_status: 'READY_FOR_DOCTOR',
    current_station: 'vitals'
  });

  await logAction({
    action: 'VITALS_RECORDED',
    encounter_id: vitalsData.encounter_id,
    patient_id: vitalsData.patient_id
  });

  await logAction({
    action: 'ENCOUNTER_STATUS_CHANGED',
    encounter_id: vitalsData.encounter_id,
    patient_id: vitalsData.patient_id
  });
};

export const saveConsultation = async (
  diagnosisData: Omit<DiagnosisRecord, 'id' | 'created_at' | 'country_code' | 'clinic_id'>,
  prescriptionData?: Omit<PrescriptionRecord, 'id' | 'created_at' | 'status' | 'country_code' | 'clinic_id'>
) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  await addDoc(collection(db, DIAGNOSES_COLLECTION), {
    ...diagnosisData,
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });

  if (prescriptionData && prescriptionData.prescriptions.length > 0) {
    await addDoc(collection(db, PRESCRIPTIONS_COLLECTION), {
      ...prescriptionData,
      status: 'PENDING',
      country_code: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp()
    });
  }

  const encounterRef = doc(db, ENCOUNTERS_COLLECTION, diagnosisData.encounter_id);
  const newStatus = prescriptionData ? 'WAITING_FOR_PHARMACY' : 'COMPLETED';
  await updateDoc(encounterRef, {
    encounter_status: newStatus,
    current_station: 'doctor'
  });

  await logAction({
    action: 'DIAGNOSIS_CREATED',
    encounter_id: diagnosisData.encounter_id,
    patient_id: diagnosisData.patient_id
  });

  if (prescriptionData) {
    await logAction({
      action: 'PRESCRIPTION_ISSUED',
      encounter_id: diagnosisData.encounter_id,
      patient_id: diagnosisData.patient_id
    });
  }

  await logAction({
    action: 'ENCOUNTER_STATUS_CHANGED',
    encounter_id: diagnosisData.encounter_id,
    patient_id: diagnosisData.patient_id
  });
};

export const getVitalsByEncounter = async (encounterId: string): Promise<VitalsRecord | null> => {
  const q = query(
    collection(db, VITALS_COLLECTION),
    where("encounter_id", "==", encounterId),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as VitalsRecord;
  }
  return null;
};

export const getDiagnosisByEncounter = async (encounterId: string): Promise<DiagnosisRecord | null> => {
  const q = query(
    collection(db, DIAGNOSES_COLLECTION),
    where("encounter_id", "==", encounterId),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as DiagnosisRecord;
  }
  return null;
};

export const getPrescriptionByEncounter = async (encounterId: string): Promise<PrescriptionRecord | null> => {
  const q = query(
    collection(db, PRESCRIPTIONS_COLLECTION),
    where("encounter_id", "==", encounterId),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PrescriptionRecord;
  }
  return null;
};

export const markPrescriptionDispensed = async (prescriptionId: string) => {
  const docRef = doc(db, PRESCRIPTIONS_COLLECTION, prescriptionId);
  const pDoc = await getDoc(docRef);
  if (pDoc.exists()) {
    const data = pDoc.data();
    await updateDoc(docRef, { status: 'DISPENSED' });
    
    const encounterRef = doc(db, ENCOUNTERS_COLLECTION, data.encounter_id);
    await updateDoc(encounterRef, { encounter_status: 'COMPLETED' });

    await logAction({
      action: 'MEDICATION_DISPENSED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });

    await logAction({
      action: 'ENCOUNTER_STATUS_CHANGED',
      encounter_id: data.encounter_id,
      patient_id: data.patient_id
    });
  }
};

export const getEncountersByPatient = async (patientId: string): Promise<Encounter[]> => {
  const q = query(
    collection(db, ENCOUNTERS_COLLECTION),
    where("patient_id", "==", patientId)
  );
  const querySnapshot = await getDocs(q);
  const encounters = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Encounter[];
  
  // Sort on client side
  encounters.sort((a, b) => {
    const timeA = a.created_at?.toMillis() || 0;
    const timeB = b.created_at?.toMillis() || 0;
    return timeB - timeA;
  });

  return encounters;
};
