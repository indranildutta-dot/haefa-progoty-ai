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

const PATIENTS_COLLECTION = "patients";

export const createPatient = async (patientData: Omit<Patient, 'id' | 'created_at' | 'country_code' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");
  
  const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), {
    ...patientData,
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });

  await logAction({
    action: 'PATIENT_CREATED',
    patient_id: docRef.id
  });

  return docRef.id;
};

export const searchPatients = async (searchParams: { first_name?: string; last_name?: string; phone?: string }) => {
  const { selectedCountry, selectedClinic } = useAppStore.getState();
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");

  let q = query(
    collection(db, PATIENTS_COLLECTION), 
    where("country_code", "==", selectedCountry.id),
    where("clinic_id", "==", selectedClinic.id)
  );
  
  if (searchParams.first_name) {
    q = query(q, where("first_name", "==", searchParams.first_name));
  }
  if (searchParams.last_name) {
    q = query(q, where("last_name", "==", searchParams.last_name));
  }
  if (searchParams.phone) {
    q = query(q, where("phone", "==", searchParams.phone));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Patient[];
};

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const docRef = doc(db, PATIENTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Patient;
  }
  return null;
};
