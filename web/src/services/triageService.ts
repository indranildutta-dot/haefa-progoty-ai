import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { TriageAssessment } from "../types";
import { getSession } from "../utils/session";

const TRIAGE_ASSESSMENTS_COLLECTION = "triage_assessments";

export const saveTriageAssessment = async (triageData: Omit<TriageAssessment, 'id' | 'created_at' | 'clinic_id' | 'country_code'>) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  await addDoc(collection(db, TRIAGE_ASSESSMENTS_COLLECTION), {
    ...triageData,
    country_code: selectedCountry.id,
    clinic_id: selectedClinic.id,
    created_at: serverTimestamp()
  });
};

export const getTriageAssessmentByEncounter = async (encounterId: string): Promise<TriageAssessment | null> => {
  const q = query(
    collection(db, TRIAGE_ASSESSMENTS_COLLECTION),
    where("encounter_id", "==", encounterId),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TriageAssessment;
  }
  return null;
};
