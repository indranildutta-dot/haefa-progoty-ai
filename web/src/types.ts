import { Timestamp } from "firebase/firestore";

export type UserRole = 'global_admin' | 'country_admin' | 'doctor' | 'nurse';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  countryCode?: string;
  assignedCountries?: string[];
  assignedClinics?: string[];
  isApproved: boolean;
  lastUpdated?: Timestamp;
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
  given_name: string;
  family_name: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth?: string;
  age_years?: number;
  age_months?: number;
  age_days?: number;
  phone?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated';
  patient_type?: string;
  national_id?: string;
  rohingya_number?: string;
  bhutanese_refugee_number?: string;
  address_type?: 'home' | 'refugee camp';
  address_line?: string;
  village?: string;
  thana?: string;
  post_code?: string;
  district?: string;
  country?: string;
  photo_url?: string;
  country_id: string;
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
  clinicalAssessment?: any;
  labInvestigations?: string[];
  referrals?: string[];
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
  type: 'allergy' | 'interaction' | 'dosage' | 'duplicate';
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

export interface TriageAssessment {
  id?: string;
  encounter_id: string;
  patient_id: string;
  clinic_id: string;
  country_code: string;
  recorded_by: string;
  created_at: Timestamp;
  allergies: string[];
  tobacco_use: 'none' | 'former' | 'current';
  alcohol_use: 'none' | 'occasional' | 'regular';
  chronic_diseases: ('diabetes' | 'hypertension' | 'asthma' | 'heart disease' | 'other')[];
  family_medical_history: string;
  pregnancy_status: 'yes' | 'no' | 'unknown';
  triage_notes: string;
}

export interface ClinicMetrics {
  clinic_id: string;
  patients_registered_today: number;
  waiting_for_vitals: number;
  ready_for_doctor: number;
  in_consultation: number;
  waiting_for_pharmacy: number;
  completed_today: number;
  avg_wait_time_minutes: number;
  last_updated: Timestamp;
}

export interface QueuePatient {
  encounterId: string;
  queueId?: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  village?: string;
  photoUrl?: string;
  triageLevel?: TriageLevel;
  encounterStatus: string;
  createdAt: Timestamp;
}
