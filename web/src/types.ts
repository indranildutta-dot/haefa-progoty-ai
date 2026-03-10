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
  country_code: string;
  clinic_id: string;
  latest_encounter_id?: string;
  last_visit_date?: Timestamp;
  encounter_count?: number;
  created_at: Timestamp;
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
}

export type TriageLevel = 'emergency' | 'urgent' | 'standard' | 'low';

export interface QueueItem {
  id?: string;
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  station: string;
  status: string;
  country_code: string;
  clinic_id: string;
  triage_level?: TriageLevel;
  priority_score?: number;
  triage_source?: 'automatic' | 'manual';
  triage_reason?: string;
  doctor_id?: string;
  doctor_called_at?: Timestamp;
  created_at: Timestamp;
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
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
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
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
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
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
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
}

export interface Encounter {
  id?: string;
  patient_id: string;
  encounter_status: EncounterStatus;
  status: EncounterStatus;
  current_station: string;
  country_code: string;
  clinic_id: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
  device_id?: string;
}

export interface Medication {
  id?: string;
  name: string;
  maxDailyDose?: number; // e.g., in mg
  unit?: string;
}

export interface DrugInteraction {
  id?: string;
  medication1Name: string;
  medication2Name: string;
  severity: 'high' | 'moderate' | 'low';
  description: string;
}

export interface PatientAllergy {
  id?: string;
  patient_id: string;
  medicationName: string;
  severity: 'high' | 'moderate' | 'low';
  notes?: string;
}

export interface SafetyAlert {
  type: 'allergy' | 'interaction' | 'dosage';
  severity: 'high' | 'moderate' | 'low';
  description: string;
  medicationNames: string[];
}

export interface ClinicConfigDocument {
  id?: string;
  clinic_name: string;
  country_code: string;
  country_name: string;
  timezone: string;
  system_name: string;
  queue_structure: string[];
  supported_roles: string[];
  language_settings: string[];
  measurement_units: {
    weight: string;
    height: string;
    temperature: string;
  };
  currency: string;
  feature_flags: Record<string, boolean>;
  system_limits: Record<string, number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AuditLog {
  id?: string;
  user_id: string;
  role: UserRole | 'unknown';
  action: 'PATIENT_CREATED' | 'VITALS_RECORDED' | 'DIAGNOSIS_CREATED' | 'PRESCRIPTION_ISSUED' | 'MEDICATION_DISPENSED' | 'ENCOUNTER_STATUS_CHANGED' | 'DOCTOR_CALLED_PATIENT';
  patient_id?: string;
  encounter_id?: string;
  timestamp: Timestamp;
  device_id: string;
  country_code: string;
  clinic_id: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  sync_status?: 'synced' | 'pending' | 'error';
}
