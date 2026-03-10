import { Timestamp } from "firebase/firestore";

export type UserRole = 'registration' | 'nurse' | 'doctor' | 'pharmacy' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  countryId?: string;
}

export type EncounterStatus = 
  | 'REGISTERED' 
  | 'WAITING_FOR_VITALS' 
  | 'READY_FOR_DOCTOR' 
  | 'IN_CONSULTATION' 
  | 'WAITING_FOR_PHARMACY' 
  | 'COMPLETED';

export interface Patient {
  id?: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  phone: string;
  village: string;
  country_id?: string; // Optional for backward compatibility
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
}

export interface QueueItem {
  id?: string;
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  station: string;
  status: string;
  countryId?: string; // Optional for backward compatibility
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
}

export interface Vitals {
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  weight: number;
  height: number;
  bmi?: number;
  oxygenSaturation?: number;
}

export interface Prescription {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface VitalsRecord extends Vitals {
  id?: string;
  encounter_id: string;
  patient_id: string;
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
  created_by: string;
}

export interface DiagnosisRecord {
  id?: string;
  encounter_id: string;
  patient_id: string;
  chief_complaint: string;
  diagnosis: string;
  notes: string;
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
  created_by: string;
}

export interface PrescriptionRecord {
  id?: string;
  encounter_id: string;
  patient_id: string;
  prescriptions: Prescription[];
  status: 'PENDING' | 'DISPENSED';
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
  created_by: string;
}

export interface Encounter {
  id?: string;
  patient_id: string;
  encounter_status: EncounterStatus;
  current_station: string;
  country_id?: string; // Optional
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
}

export interface AuditLog {
  id?: string;
  user_id: string;
  role: UserRole | 'unknown';
  action: 'PATIENT_CREATED' | 'VITALS_RECORDED' | 'DIAGNOSIS_CREATED' | 'PRESCRIPTION_ISSUED' | 'MEDICATION_DISPENSED' | 'ENCOUNTER_STATUS_CHANGED';
  patient_id?: string;
  encounter_id?: string;
  timestamp: Timestamp;
  device_id: string;
  country_code: string;
  clinic_id: string;
}
