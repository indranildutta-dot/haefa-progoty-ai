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
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { 
  Encounter, 
  Vitals, 
  EncounterStatus, 
  Prescription, 
  VitalsRecord, 
  DiagnosisRecord, 
  PrescriptionRecord 
} from "../types";
import { getSession } from "../utils/session";
import { logAction } from "./auditService";
import { updateQueueMetric } from "./queueMetricsService";
import { handleFirestoreError, OperationType } from "../utils/firestoreError";

const ENCOUNTERS_COLLECTION = "encounters";
const ENCOUNTERS_ARCHIVE_COLLECTION = "encounters_archive";
const VITALS_COLLECTION = "vitals";
const DIAGNOSES_COLLECTION = "diagnoses";
const PRESCRIPTIONS_COLLECTION = "prescriptions";

/**
 * Creates a new encounter and updates patient visit metrics.
 */
export const createEncounter = async (patient_id: string) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  console.log(`Creating encounter for patient ${patient_id} in clinic ${selectedClinic.id}...`);

  try {
    await updateQueueMetric(selectedClinic.id, {
      patients_registered_today: 1,
      waiting_for_vitals: 1
    });
  } catch (e) {
    console.error("Failed to update queue metric, but continuing...", e);
  }

  let docRef;
  try {
    const encounterData = {
      patient_id,
      encounter_status: 'WAITING_FOR_VITALS',
      status: 'WAITING_FOR_VITALS',
      current_station: 'registration',
      country_id: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    docRef = await addDoc(collection(db, ENCOUNTERS_COLLECTION), encounterData);
    console.log(`Encounter document created with ID: ${docRef.id}`);
  } catch (e) {
    console.error("Error creating encounter document:", e);
    handleFirestoreError(e, OperationType.WRITE, ENCOUNTERS_COLLECTION);
    throw e;
  }

  try {
    const patientRef = doc(db, "patients", patient_id);
    await updateDoc(patientRef, {
      latest_encounter_id: docRef.id,
      last_visit_date: serverTimestamp(),
      encounter_count: increment(1),
      updated_at: serverTimestamp()
    });
    console.log(`Patient ${patient_id} updated with latest encounter ID: ${docRef.id}`);
  } catch (e) {
    console.error("Error updating patient document:", e);
    handleFirestoreError(e, OperationType.WRITE, `patients/${patient_id}`);
    throw e;
  }

  return docRef.id;
};

/**
 * UPDATED: Saves consultation data via Cloud Function to ensure Atomic Transactions
 * and trigger automated Requisitions for non-inventory items.
 */
export const saveConsultation = async (
  diagnosisData: Omit<DiagnosisRecord, 'id' | 'created_at' | 'country_id' | 'clinic_id'>,
  prescriptionData?: Omit<PrescriptionRecord, 'id' | 'created_at' | 'status' | 'country_id' | 'clinic_id'>,
  isFinalize: boolean = false
) => {
  const { selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  // Call the 'saveConsultation' Cloud Function we added to index.ts
  const saveConsultationFunction = httpsCallable(functions, 'saveConsultation');
  
  try {
    const result = await saveConsultationFunction({
      encounterId: diagnosisData.encounter_id,
      patientId: diagnosisData.patient_id,
      clinicId: selectedClinic.id,
      prescriptions: prescriptionData?.prescriptions || [],
      diagnosis: diagnosisData.diagnosis,
      notes: diagnosisData.notes || "",
      treatment_notes: diagnosisData.treatment_notes || "",
      labInvestigations: diagnosisData.labInvestigations || [],
      referrals: diagnosisData.referrals || [],
      assessment: diagnosisData.assessment || null,
      isFinalize
    });

    if (isFinalize) {
      // Logging the successful hand-off for audit purposes
      await logAction({
        action: 'DIAGNOSIS_CREATED',
        encounter_id: diagnosisData.encounter_id,
        patient_id: diagnosisData.patient_id
      });
    }

    return result.data;
  } catch (error) {
    console.error("Failed to save consultation via Cloud Function:", error);
    throw error;
  }
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

export const saveVitals = async (
  vitalsData: Omit<VitalsRecord, 'id' | 'created_at' | 'country_id' | 'clinic_id'>,
  nextStatus: EncounterStatus = 'READY_FOR_DOCTOR'
) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  // Check if vitals already exist for this encounter
  const q = query(
    collection(db, VITALS_COLLECTION),
    where("encounter_id", "==", vitalsData.encounter_id),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  
  // Filter out NaN and undefined values to prevent overwriting existing data with "empty" states
  const cleanVitalsData = Object.entries(vitalsData).reduce((acc: any, [key, value]) => {
    if (value !== undefined && !Number.isNaN(value)) {
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!querySnapshot.empty) {
    // Update existing
    const docId = querySnapshot.docs[0].id;
    await updateDoc(doc(db, VITALS_COLLECTION, docId), {
      ...cleanVitalsData,
      updated_at: serverTimestamp()
    });
  } else {
    // Create new
    await addDoc(collection(db, VITALS_COLLECTION), {
      ...cleanVitalsData,
      country_id: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  }
  
  const encounterRef = doc(db, ENCOUNTERS_COLLECTION, vitalsData.encounter_id);
  const encounterSnap = await getDoc(encounterRef);
  const clinicId = encounterSnap.exists() ? encounterSnap.data().clinic_id : undefined;

  if (clinicId) {
    await updateQueueMetric(clinicId, {
      waiting_for_vitals: -1,
      ready_for_doctor: nextStatus === 'READY_FOR_DOCTOR' ? 1 : 0
    });
  }

  let station = 'vitals';
  if (nextStatus === 'READY_FOR_DOCTOR' || nextStatus === 'IN_CONSULTATION') station = 'doctor';
  else if (nextStatus === 'WAITING_FOR_PHARMACY') station = 'pharmacy';
  else if (nextStatus === 'COMPLETED') station = 'completed';

  await updateDoc(encounterRef, {
    encounter_status: nextStatus,
    current_station: station,
    updated_at: serverTimestamp()
  });

  await logAction({
    action: 'VITALS_RECORDED',
    encounter_id: vitalsData.encounter_id,
    patient_id: vitalsData.patient_id
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

export const getLatestVitals = async (patientId: string): Promise<VitalsRecord | null> => {
  try {
    const q = query(
      collection(db, VITALS_COLLECTION),
      where("patient_id", "==", patientId),
      orderBy("created_at", "desc"),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as VitalsRecord;
    }
  } catch (err) {
    console.error("Could not fetch latest vitals. Possible missing index.", err);
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
    const data = pDoc.data() as any;
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

/**
 * Fetches all related data for a patient's entire visit history.
 */
export const getPatientFullHistory = async (patientId: string) => {
  try {
    const [encounters, vitals, diagnoses, prescriptions, dispensations] = await Promise.all([
      getPatientHistory(patientId),
      getDocs(query(collection(db, "vitals"), where("patient_id", "==", patientId), orderBy("created_at", "desc"))),
      getDocs(query(collection(db, "diagnoses"), where("patient_id", "==", patientId), orderBy("created_at", "desc"))),
      getDocs(query(collection(db, "prescriptions"), where("patient_id", "==", patientId), orderBy("created_at", "desc"))),
      getDocs(query(collection(db, "dispensations"), where("patient_id", "==", patientId), orderBy("created_at", "desc")))
    ]);

    return {
      encounters,
      vitals: vitals.docs.map(d => ({ id: d.id, ...d.data() })),
      diagnoses: diagnoses.docs.map(d => ({ id: d.id, ...d.data() })),
      prescriptions: prescriptions.docs.map(d => ({ id: d.id, ...d.data() })),
      dispensations: dispensations.docs.map(d => ({ id: d.id, ...d.data() }))
    };
  } catch (error) {
    console.error("Error fetching full patient history:", error);
    throw error;
  }
};
