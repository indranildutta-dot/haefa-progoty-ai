import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getPatientById } from "./patientService";
import { Patient } from "../types";

export const getPatientByQrToken = async (token: string): Promise<Patient | null> => {
  try {
    const tokenRef = doc(db, "badge_tokens", token);
    const tokenSnap = await getDoc(tokenRef);
    
    if (tokenSnap.exists()) {
      const patientId = tokenSnap.data().patient_id;
      return await getPatientById(patientId);
    }
    return null;
  } catch (error) {
    console.error("Error looking up patient by QR token:", error);
    return null;
  }
};
