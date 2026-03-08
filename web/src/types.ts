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
  country_id: string;
  created_at: Timestamp;
}

export interface QueueItem {
  id?: string;
  encounter_id: string;
  patient_id: string;
  station: string;
  status: string;
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

export interface Encounter {
  id?: string;
  patient_id: string;
  encounter_status: string;
  current_station: string;
  vitals?: Vitals;
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  prescriptions?: Prescription[];
  country_id: string;
  created_at: Timestamp;
}
