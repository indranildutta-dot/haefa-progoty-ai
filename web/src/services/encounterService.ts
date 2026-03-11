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
  limit,
  increment
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
import { updateQueueMetric } from "./queueMetricsService";

const ENCOUNTERS_COLLECTION = "encounters";
const ENCOUNTERS_ARCHIVE_COLLECTION = "encounters_archive";
const VITALS_COLLECTION = "vitals";
const DIAGNOSES_COLLECTION = "diagnoses";
const PRESCRIPTIONS_COLLECTION = "prescriptions";

export const createEncounter = async (patient_id: string) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  await updateQueueMetric(selectedClinic.id, {
    patients_registered_today: 1,
    waiting_for_vitals: 1
  });

  const docRef = await addDoc(collection(db, ENCOUNTERS_COLLECTION), {
    patient_id,
    encounter_status: 'WAITING_FOR_VITALS',
    status: 'WAITING_FOR_VITALS',
    current_station: 'registration',
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  const patientRef = doc(db, "patients", patient_id);
  await updateDoc(patientRef, {
    latest_encounter_id: docRef.id,
    last_visit_date: serverTimestamp(),
    encounter_count: increment(1),
    updated_at: serverTimestamp()
  });

  return docRef.id;
};

export const getPatientHistory = async (patientId: string): Promise<Encounter[]> => {
  const activeQuery = query(
    collection(db, ENCOUNTERS_COLLECTION),
    where("patient_id", "==", patientId),
    orderBy("created_at", "desc"),
    limit(20)
  );
  const activeSnapshot = await getDocs(activeQuery);
  let encounters = activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Encounter));

  if (encounters.length < 20) {
    const archiveQuery = query(
      collection(db, ENCOUNTERS_ARCHIVE_COLLECTION),
      where("patient_id", "==", patientId),
      orderBy("created_at", "desc")
    );
    const archiveSnapshot = await getDocs(archiveQuery);
    const archivedEncounters = archiveSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Encounter));
    encounters = [...encounters, ...archivedEncounters];
  }
  
  return encounters.sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis());
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
    where("patient_id", "==", patientId),
    orderBy("created_at", "desc"),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;

  const docSnap = querySnapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Encounter;
};

export const updateEncounterStatus = async (encounterId: string, status: EncounterStatus) => {
  const docRef = doc(db, ENCOUNTERS_COLLECTION, encounterId);
  const docSnap = await getDoc(docRef);
  const patientId = docSnap.exists() ? docSnap.data().patient_id : undefined;

  await updateDoc(docRef, {
    encounter_status: status,
    updated_at: serverTimestamp()
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
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  
  const encounterRef = doc(db, ENCOUNTERS_COLLECTION, vitalsData.encounter_id);
  const encounterSnap = await getDoc(encounterRef);
  const clinicId = encounterSnap.exists() ? encounterSnap.data().clinic_id : undefined;

  if (clinicId) {
    await updateQueueMetric(clinicId, {
      waiting_for_vitals: -1,
      ready_for_doctor: 1
    });
  }

  await updateDoc(encounterRef, {
    encounter_status: 'READY_FOR_DOCTOR',
    current_station: 'vitals',
    updated_at: serverTimestamp()
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
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  if (prescriptionData && prescriptionData.prescriptions.length > 0) {
    await addDoc(collection(db, PRESCRIPTIONS_COLLECTION), {
      ...prescriptionData,
      status: 'PENDING',
      country_code: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  }

  const encounterRef = doc(db, ENCOUNTERS_COLLECTION, diagnosisData.encounter_id);
  const encounterSnap = await getDoc(encounterRef);
  const clinicId = encounterSnap.exists() ? encounterSnap.data().clinic_id : undefined;

  const newStatus = prescriptionData ? 'WAITING_FOR_PHARMACY' : 'COMPLETED';
  
  if (clinicId) {
    const metrics: any = { in_consultation: -1 };
    if (newStatus === 'WAITING_FOR_PHARMACY') {
      metrics.waiting_for_pharmacy = 1;
    } else {
      metrics.completed_today = 1;
    }
    await updateQueueMetric(clinicId, metrics);
  }

  await updateDoc(encounterRef, {
    encounter_status: newStatus,
    current_station: 'doctor',
    updated_at: serverTimestamp()
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
    await updateDoc(docRef, { 
      status: 'DISPENSED',
      updated_at: serverTimestamp()
    });
    
    const encounterRef = doc(db, ENCOUNTERS_COLLECTION, data.encounter_id);
    const encounterSnap = await getDoc(encounterRef);
    const clinicId = encounterSnap.exists() ? encounterSnap.data().clinic_id : undefined;

    if (clinicId) {
      await updateQueueMetric(clinicId, {
        waiting_for_pharmacy: -1,
        completed_today: 1
      });
    }

    await updateDoc(encounterRef, { 
      encounter_status: 'COMPLETED',
      updated_at: serverTimestamp()
    });

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

export const getEncountersByPatient = async (patientId: string, includeArchived: boolean = false): Promise<Encounter[]> => {
  const q = query(
    collection(db, includeArchived ? "encounters_archive" : "encounters"),
    where("patient_id", "==", patientId),
    orderBy("created_at", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Encounter[];
};
