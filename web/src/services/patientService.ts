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
  Timestamp,
  or,
  and
} from "firebase/firestore";
import { db } from "../firebase";
import { Patient } from "../types";
import { getSession } from "../utils/session";
import { logAction } from "./auditService";

import { updateMetrics } from "./metricsService";

const PATIENTS_COLLECTION = "patients";

export const createPatient = async (patientData: Omit<Patient, 'id' | 'created_at' | 'country_id' | 'clinic_id'>) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");
  
  console.log("Creating patient:", patientData, selectedCountry.id, selectedClinic.id);
  
  const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), {
    ...patientData,
    // Standardize names (save both versions for compatibility)
    first_name: patientData.given_name,
    last_name: patientData.family_name,
    // Standardize location (save both versions for compatibility)
    country_id: selectedCountry.id,
    country_code: selectedCountry.id,
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

export const searchPatients = async (searchParams: { 
  given_name?: string; 
  family_name?: string; 
  phone?: string;
  national_id?: string;
  rohingya_number?: string;
  bhutanese_refugee_number?: string;
  nepal_id?: string;
  patient_type?: string;
}) => {
  const { selectedCountry, selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  console.log("Searching patients:", searchParams, selectedCountry.id, selectedClinic.id);

  // Support legacy country IDs and names for searching
  const countryIds = [selectedCountry.id];
  if (selectedCountry.id === 'BD') {
    countryIds.push('bangladesh');
    countryIds.push('Bangladesh');
  }
  if (selectedCountry.id === 'NP') {
    countryIds.push('nepal');
    countryIds.push('Nepal');
  }
  if (selectedCountry.id === 'SB') {
    countryIds.push('solomon islands');
    countryIds.push('Solomon Islands');
  }

  // Use AND query to combine country filter OR and clinic filter
  const q = query(
    collection(db, PATIENTS_COLLECTION), 
    and(
      or(
        where("country_id", "in", countryIds),
        where("country_code", "in", countryIds)
      ),
      where("clinic_id", "==", selectedClinic.id)
    )
  );
  
  const querySnapshot = await getDocs(q);
  const allPatients = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[]; // Use any to handle legacy fields
  
  const results = allPatients.filter(patient => {
    let match = true;
    
    // Clinic filter (legacy check)
    // If patient has a clinic_id, it must match selected clinic
    // If they don't have one, we include them (legacy data)
    if (patient.clinic_id && patient.clinic_id !== selectedClinic.id && patient.clinic_id !== selectedClinic.name) {
      match = false;
    }
    
    // Name filters - check both given_name/first_name and family_name/last_name
    const pGivenName = (patient.given_name || patient.first_name || '').toLowerCase();
    const pFamilyName = (patient.family_name || patient.last_name || '').toLowerCase();

    if (searchParams.given_name && !pGivenName.includes(searchParams.given_name.toLowerCase())) match = false;
    if (searchParams.family_name && !pFamilyName.includes(searchParams.family_name.toLowerCase())) match = false;
    
    // Phone filter
    if (searchParams.phone) {
      const patientPhone = String(patient.phone || '');
      if (!patientPhone.includes(searchParams.phone)) match = false;
    }
    
    // ID filters
    if (searchParams.national_id) {
      const patientId = String(patient.national_id || '').toLowerCase();
      if (!patientId.includes(searchParams.national_id.toLowerCase())) match = false;
    }
    
    if (searchParams.rohingya_number) {
      const patientId = String(patient.rohingya_number || '').toLowerCase();
      if (!patientId.includes(searchParams.rohingya_number.toLowerCase())) match = false;
    }
    
    if (searchParams.bhutanese_refugee_number) {
      const patientId = String(patient.bhutanese_refugee_number || '').toLowerCase();
      if (!patientId.includes(searchParams.bhutanese_refugee_number.toLowerCase())) match = false;
    }

    if (searchParams.nepal_id) {
      const nationalId = String(patient.national_id || '').toLowerCase();
      const bhutaneseId = String(patient.bhutanese_refugee_number || '').toLowerCase();
      const nepalId = String(patient.nepal_id || '').toLowerCase();
      const searchId = searchParams.nepal_id.toLowerCase();
      
      if (!nationalId.includes(searchId) && !bhutaneseId.includes(searchId) && !nepalId.includes(searchId)) {
        match = false;
      }
    }
    
    return match;
  });
  
  // Map legacy fields back to standard Patient type for the UI
  return results.map(p => ({
    ...p,
    given_name: p.given_name || p.first_name || '',
    family_name: p.family_name || p.last_name || '',
    country_id: p.country_id || p.country_code || selectedCountry.id
  })) as Patient[];
};

export const updatePatient = async (id: string, patientData: Partial<Patient>) => {
  const docRef = doc(db, PATIENTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...patientData,
    updated_at: serverTimestamp()
  });

  await logAction({
    action: 'PATIENT_CREATED', // Using PATIENT_CREATED as a proxy for update for now if no specific action exists
    patient_id: id
  });
};

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const docRef = doc(db, PATIENTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Patient;
  }
  return null;
};
