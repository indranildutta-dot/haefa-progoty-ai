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

const PATIENTS_COLLECTION = "patients";

export const createPatient = async (patientData: Omit<Patient, 'id' | 'created_at'>) => {
  const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), {
    ...patientData,
    created_at: serverTimestamp()
  });
  return docRef.id;
};

export const searchPatients = async (searchParams: { first_name?: string; last_name?: string; phone?: string }, country_id: string) => {
  let q = query(collection(db, PATIENTS_COLLECTION), where("country_id", "==", country_id));
  
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
