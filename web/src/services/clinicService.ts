import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { ClinicConfigDocument } from "../types";

const CLINICS_COLLECTION = "clinics";

export const getClinicConfig = async (countryCode: string, clinicId: string): Promise<ClinicConfigDocument | null> => {
  const q = query(
    collection(db, CLINICS_COLLECTION),
    where("country_code", "==", countryCode),
    where("clinic_name", "==", clinicId) // Assuming clinic_name or a specific ID field matches. Let's use doc ID or a field.
  );
  
  // Actually, it's better to use the clinicId as the document ID or query by it.
  // Let's query by country_code and clinic_name for now, or just fetch the doc if the ID is known.
  // The prompt says: "Create a new Firestore collection called 'clinics'."
  // Let's assume the document ID is `${countryCode}_${clinicId}` or we just query.
  const snap = await getDocs(q);
  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ClinicConfigDocument;
  }
  return null;
};

export const createDefaultClinicConfig = async (countryCode: string, countryName: string, clinicId: string, clinicName: string) => {
  const docId = `${countryCode}_${clinicId}`;
  const docRef = doc(db, CLINICS_COLLECTION, docId);
  
  const defaultConfig: Omit<ClinicConfigDocument, 'id'> = {
    clinic_name: clinicName,
    country_code: countryCode,
    country_name: countryName,
    timezone: "UTC",
    system_name: "HAEFA Progoty",
    queue_structure: ["registration", "vitals", "doctor", "pharmacy"],
    supported_roles: ["registration", "nurse", "doctor", "pharmacy", "admin"],
    language_settings: ["en"],
    measurement_units: {
      weight: "kg",
      height: "cm",
      temperature: "celsius"
    },
    currency: "USD",
    feature_flags: {
      enable_pharmacy: true,
      enable_lab: false
    },
    system_limits: {
      max_patients_per_day: 200
    },
    created_at: serverTimestamp() as any,
    updated_at: serverTimestamp() as any
  };

  await setDoc(docRef, defaultConfig);
  return { id: docId, ...defaultConfig } as ClinicConfigDocument;
};

export const getOrCreateClinicConfig = async (countryCode: string, countryName: string, clinicId: string, clinicName: string): Promise<ClinicConfigDocument> => {
  const docId = `${countryCode}_${clinicId}`;
  const docRef = doc(db, CLINICS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as ClinicConfigDocument;
  }
  
  return await createDefaultClinicConfig(countryCode, countryName, clinicId, clinicName);
};
