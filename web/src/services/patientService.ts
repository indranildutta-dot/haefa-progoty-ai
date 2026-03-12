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
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { Patient } from "../types";
import { useAppStore } from "../store/useAppStore";
import { logAction } from "./auditService";

import { updateMetrics } from "./metricsService";

const PATIENTS_COLLECTION = "patients";

export const createPatient = async (patientData: Omit<Patient, 'id' | 'created_at' | 'country_id' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");
  
  console.log("Creating patient:", patientData, selectedCountry.id, selectedClinic.id);
  
  const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), {
    ...patientData,
    country_id: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  console.log("Patient created:", docRef.id);

  await logAction({
    action: 'PATIENT_CREATED',
    patient_id: docRef.id
  });

  await updateMetrics(selectedClinic.id, selectedCountry.id, {
    patients_today: 1
  });

  return docRef.id;
};

export const searchPatients = async (searchParams: { first_name?: string; last_name?: string; phone?: string }) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  console.log("Searching patients:", searchParams, selectedCountry.id, selectedClinic.id);

  // Fetch all patients for this country and clinic to debug
  // Note: Using country_id as per the Firebase document structure
  const q = query(
    collection(db, PATIENTS_COLLECTION), 
    where("country_id", "==", selectedCountry.id)
  );
  
  const querySnapshot = await getDocs(q);
  const allPatients = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Patient[];
  
  console.log("All patients in country:", allPatients);

  // Filter in memory for debugging
  const results = allPatients.filter(patient => {
    let match = true;
    // Check clinic_id if available
    if (patient.clinic_id && patient.clinic_id !== selectedClinic.id) match = false;
    
    if (searchParams.first_name && !patient.first_name.toLowerCase().includes(searchParams.first_name.toLowerCase())) match = false;
    if (searchParams.last_name && !patient.last_name.toLowerCase().includes(searchParams.last_name.toLowerCase())) match = false;
    if (searchParams.phone && patient.phone && !patient.phone.includes(searchParams.phone)) match = false;
    else if (searchParams.phone && !patient.phone) match = false;
    
    return match;
  });
  
  console.log("Filtered search results:", results);
  
  return results;
};

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const docRef = doc(db, PATIENTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Patient;
  }
  return null;
};
