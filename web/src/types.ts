import { Timestamp } from "firebase/firestore";

export type UserRole = 'global_admin' | 'country_admin' | 'doctor' | 'nurse' | 'registration' | 'pharmacy' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  country_id?: string;
  assignedCountries?: string[];
  assignedClinics?: string[];
  isApproved: boolean;
  lastUpdated?: Timestamp;
  professional_reg_no?: string;
  professional_body?: string;
  designation?: string;
}

export type EncounterStatus = 
  | 'REGISTERED' 
  | 'WAITING_FOR_VITALS' 
  | 'WAITING_FOR_VITALS_2' 
  | 'WAITING_FOR_VITALS_3' 
  | 'READY_FOR_DOCTOR' 
  | 'IN_CONSULTATION' 
  | 'WAITING_FOR_PHARMACY' 
  | 'COMPLETED'
  | 'CANCELLED';

export type TriageLevel = 'emergency' | 'urgent' | 'standard' | 'low';

export interface Patient {
  id?: string;
  given_name: string;
  middle_name?: string;
  family_name: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  estimated_birth_year?: number;
  is_minor?: boolean;
  parent_name?: string;
  parent_id?: string;
  age_years?: number;
  age_months?: number;
  age_days?: number;
  phone?: string;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated';
  national_id?: string;
  rohingya_number?: string;
  bhutanese_refugee_number?: string;
  nepal_id?: string;
  patient_type?: string;
  address_type?: 'home' | 'refugee camp';
  is_fdmn?: boolean;
  camp_name?: string;
  block_number?: string;
  majhi_name?: string;
  tent_number?: string;
  fcn_number?: string;
  address_line?: string;
  village?: string;
  thana?: string;
  upazila?: string;
  union?: string;
  post_code?: string;
  district?: string;
  country?: string;
  father_given_name?: string;
  father_family_name?: string;
  mother_given_name?: string;
  mother_family_name?: string;
  permanent_address_same_as_present?: boolean;
  perm_address_line?: string;
  perm_village?: string;
  perm_district?: string;
  perm_upazila?: string;
  perm_union?: string;
  perm_post_code?: string;
  perm_country?: string;
  photo_url?: string;
  country_id: string;
  clinic_id: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
  last_visit_date?: Timestamp;
  latest_encounter_id?: string;
  encounter_count?: number;
  triage_level?: string;
  currentVitals?: VitalsRecord;
  chronic_diseases?: string[];
}

// FIXED: Added missing properties requested by AI Studio
export interface SocialHistory {
  take_any: boolean;
  smoking: boolean;
  betel_nuts: boolean;
  chewing_tobacco: boolean;
  recreational_drugs: boolean;
  housing: 'Catcha' | 'Paka';
  water_source: 'Safe' | 'Unsafe';
}

export interface Vitals {
  systolic: number;
  diastolic: number;
  systolic_2?: number;
  diastolic_2?: number;
  heartRate: number;
  respiratoryRate: number;
  temperature: number;
  weight: number;
  height: number;
  bmi?: number;
  bmi_class?: string;
  muac?: number;
  muac_class?: string;
  blood_group?: string;
  oxygenSaturation?: number;
  blood_sugar?: number;
  rbg?: number;
  fbg?: number;
  hours_since_meal?: number;
  hemoglobin?: number;
  is_pregnant?: boolean;
  is_fasting?: boolean;
  has_symptoms?: boolean;
  pregnancy_months?: number;
  allergies?: string[];
  social_history?: SocialHistory;
  alcohol_use?: string;
  created_by?: string;
}

export interface QueueItem {
  id?: string;
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  status: EncounterStatus;
  station: string;
  country_id: string;
  clinic_id: string;
  triage_level?: TriageLevel;
  priority_score?: number;
  doctor_id?: string;
  doctor_called_at?: Timestamp;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface Encounter {
  id?: string;
  patient_id: string;
  encounter_status: EncounterStatus;
  status: EncounterStatus;
  current_station: string;
  country_id: string;
  clinic_id: string;
  triage_level?: TriageLevel;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Prescription {
  medicationId: string;
  medicationName: string;
  dosageValue: string;
  dosageUnit: string;
  frequencyValue: number;
  frequencyUnit: string;
  durationValue: number;
  durationUnit: string;
  quantity: number;
  instructions: string;
  isCustom?: boolean;
  isRequisition?: boolean;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export interface VitalsRecord {
  id?: string;
  patient_id: string;
  encounter_id: string;
  clinic_id: string;
  country_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bmi_class?: string;
  muac?: number;
  muac_class?: string;
  blood_group?: string;
  oxygenSaturation?: number;
  blood_sugar?: number;
  rbg?: number;
  fbg?: number;
  hours_since_meal?: number;
  hemoglobin?: number;
  systolic_2?: number;
  diastolic_2?: number;
  is_pregnant?: boolean;
  is_fasting?: boolean;
  has_symptoms?: boolean;
  pregnancy_months?: number;
  allergies?: string[];
  social_history?: SocialHistory;
  alcohol_use?: string;
  created_by?: string;
  chief_complaint?: string;
  onset_date?: string;
  duration_value?: string;
  duration_unit?: string;
  chronic_conditions?: string[];
  nurse_priority?: string;
  suggested_priority?: string;
  assigned_priority?: string;
}

export interface DiagnosisRecord {
  id?: string;
  patient_id: string;
  encounter_id: string;
  clinic_id: string;
  country_id: string;
  diagnosis: string;
  notes: string;
  treatment_notes?: string;
  chief_complaint?: string;
  labInvestigations?: string[];
  referrals?: string[];
  assessment?: any; // Using any to accommodate ClinicalAssessmentData without circular imports or complex nesting
  prescriber_name?: string;
  prescriber_reg_no?: string;
  prescriber_body?: string;
  prescriber_designation?: string;
  created_at: Timestamp;
}

export interface PrescriptionRecord {
  id?: string;
  patient_id: string;
  encounter_id: string;
  clinic_id: string;
  country_id: string;
  prescriptions: Prescription[];
  status: 'PENDING' | 'DISPENSED';
  dispenser_name?: string;
  dispenser_reg_no?: string;
  dispenser_body?: string;
  dispensation_details?: any[];
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface TriageAssessment {
  id?: string;
  patient_id: string;
  encounter_id: string;
  clinic_id: string;
  country_id: string;
  triage_level: TriageLevel;
  notes: string;
  chronic_diseases?: string[];
  tobacco_use?: string;
  alcohol_use?: string;
  triage_notes?: string;
  chief_complaint?: string;
  created_at: Timestamp;
}

export interface QueuePatient {
  encounterId: string;
  queueId: string;
  patientId: string;
  patientName: string;
  triageLevel: TriageLevel;
  encounterStatus: EncounterStatus;
  createdAt: Timestamp;
  waitTimeDisplay: string;
  triageColor: string;
  photoUrl?: string;
  ageDisplay?: string;
  gender?: string;
  village?: string;
}

export interface AuditLog {
  id?: string;
  action: string;
  encounter_id?: string;
  patient_id?: string;
  user_id: string;
  country_id: string;
  clinic_id: string;
  metadata?: any;
  created_at: Timestamp;
}

export interface ClinicConfigDocument {
  id?: string;
  name: string;
  clinic_name?: string;
  address?: string;
  country_id: string;
  country_name?: string;
  timezone?: string;
  system_name?: string;
  queue_structure?: string[];
  supported_roles?: string[];
  language_settings?: string[];
  measurement_units?: {
    weight: string;
    height: string;
    temperature: string;
  };
  currency?: string;
  feature_flags?: {
    enable_pharmacy: boolean;
    enable_lab: boolean;
  };
  system_limits?: {
    max_patients_per_day: number;
  };
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface Medication {
  id?: string;
  name: string;
  generic_name: string;
  form: string;
  strength: string;
  cold_chain_req: boolean;
  base_unit: string;
  package_unit: string;
  package_size: number;
  unit?: string;
  maxDailyDose?: number;
}

export interface DrugInteraction {
  id?: string;
  medication_id_1: string;
  medication_id_2: string;
  medication1Name?: string;
  medication2Name?: string;
  severity: 'low' | 'moderate' | 'high';
  description: string;
}

export interface SafetyAlert {
  id?: string;
  medication_id?: string;
  alert_type?: string;
  description: string;
  type?: string;
  severity?: 'low' | 'moderate' | 'high';
  medicationNames?: string[];
}

export interface PatientAllergy {
  id?: string;
  patient_id: string;
  allergy: string;
  severity: 'low' | 'moderate' | 'high';
  country_id: string;
  clinic_id: string;
  created_at: Timestamp;
  medicationName?: string;
  notes?: string;
}