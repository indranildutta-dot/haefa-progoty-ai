import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Firestore,
  Timestamp,
  startAt,
  endAt
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { DailySummary } from '../types';
import { FilterState } from '../components/analytics/AnalyticsFilters';

/**
 * UNIVERSAL SANITIZER
 * Ensures the dashboard never crashes due to malformed Firestore records.
 */
const sanitizeSummary = (data: any): DailySummary => {
  return {
    date: data.date || new Date().toISOString().split('T')[0],
    clinic_id: data.clinic_id || 'unknown',
    country_id: data.country_id || 'BD',
    total_patients: Number(data.total_patients) || 0,
    new_patients: Number(data.new_patients) || 0,
    triage_counts: data.triage_counts || {},
    gender_counts: data.gender_counts || {},
    age_group_counts: data.age_group_counts || { pediatric: 0, adult: 0, geriatric: 0 },
    disease_prevalence: data.disease_prevalence || {},
    avg_wait_times: data.avg_wait_times || { reg_to_vitals: 0, vitals_to_doc: 0, doc_to_pharmacy: 0 },
    medication_volumes: data.medication_volumes || {},
    referral_reasons: data.referral_reasons || {},
    ncd_metrics: data.ncd_metrics || { avg_sbp: 0, avg_dbp: 0, avg_glucose: 0 },
    maternal_health: data.maternal_health || { anc_visits: 0, high_risk_pregnancies: 0 },
    nutrition: data.nutrition || { muac_green: 0, muac_yellow: 0, muac_red: 0 },
    infectious_disease: data.infectious_disease || { tb_suspected_cases: 0 },
    provider_metrics: data.provider_metrics || { consultations_per_doctor: {}, screenings_per_nurse: {}, dispensations_per_pharmacist: {} },
    clinical_outcomes: data.clinical_outcomes || { bp_controlled_rate: 0, glucose_controlled_rate: 0 },
    operational_efficiency: data.operational_efficiency || { hourly_visit_distribution: {}, avg_session_duration: {} },
    cv_risk_metrics: data.cv_risk_metrics || { 
      lab_based: { '<5%': 0, '5-10%': 0, '10-20%': 0, '20-30%': 0, '>=30%': 0 },
      non_lab_based: { '<5%': 0, '5-10%': 0, '10-20%': 0, '20-30%': 0, '>=30%': 0 }
    },
    comorbidity_map: data.comorbidity_map || {},
    last_updated: data.last_updated || Timestamp.now()
  };
};

/**
 * Trigger background data aggregation
 */
export const triggerAggregation = async () => {
  const functions = getFunctions();
  const trigger = httpsCallable(functions, 'triggerAggregation');
  return trigger();
};

/**
 * Fetches aggregated summaries based on the provided filters.
 */
export const fetchDailySummaries = async (filters: FilterState): Promise<{ data: DailySummary[], isPreview: boolean }> => {
  try {
    const dailyRef = collection(db, 'daily_summaries');
    let constraints: any[] = [];

    // Apply Equality Filters FIRST
    if (filters.clinicId !== 'all') {
      constraints.push(where('clinic_id', '==', filters.clinicId));
    }

    if (filters.countryId && filters.countryId !== 'all') {
      constraints.push(where('country_id', '==', filters.countryId));
    }
    
    // Apply Range Filters
    if (filters.dateRange[0]) {
      constraints.push(where('date', '>=', filters.dateRange[0]));
    }
    if (filters.dateRange[1]) {
      constraints.push(where('date', '<=', filters.dateRange[1]));
    }

    // Apply OrderBy LAST
    constraints.push(orderBy('date', 'desc'));

    const q = query(dailyRef, ...constraints);
    const snapshot = await getDocs(q);
    
    // If empty, return generated preview data for demo purposes
    if (snapshot.empty) {
      console.warn("No daily summaries found. Generating preview data for HAEFA Board Review.");
      return { data: generatePreviewData(), isPreview: true };
    }

    return { 
      data: snapshot.docs.map(doc => sanitizeSummary(doc.data())), 
      isPreview: false 
    };
  } catch (error) {
    console.error("fetchDailySummaries Error:", error);
    return { data: generatePreviewData(), isPreview: true };
  }
};

/**
 * GENERATE PREVIEW DATA
 * Creates a robust 30-day realistic clinical dataset for the "Power BI" experience.
 */
const generatePreviewData = (): DailySummary[] => {
  const data: DailySummary[] = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    data.push(sanitizeSummary({
      date: dateStr,
      clinic_id: 'dhaka-main',
      // Realism Adjustment: Lower daily volumes for individual clinics
      total_patients: 15 + Math.floor(Math.random() * 25),
      new_patients: 2 + Math.floor(Math.random() * 5),
      disease_prevalence: {
        'Hypertension (BA00)': 8 + Math.floor(Math.random() * 5),
        'Type 2 Diabetes (5A11)': 6 + Math.floor(Math.random() * 4),
        'Common Cold (CA0Z)': 10 + Math.floor(Math.random() * 10),
        'COPD (CA22)': 2 + Math.floor(Math.random() * 3),
        'Osteoarthritis (FA01)': 4 + Math.floor(Math.random() * 4)
      },
      comorbidity_map: {
        'Hypertension (BA00)': {
          '_total': { 'Type 2 Diabetes (5A11)': 3 + Math.floor(Math.random() * 3), 'Osteoarthritis (FA01)': 2, 'Anemia': 1 },
          'Male': { 'Type 2 Diabetes (5A11)': 1, 'Osteoarthritis (FA01)': 1 },
          'Female': { 'Type 2 Diabetes (5A11)': 2, 'Osteoarthritis (FA01)': 1, 'Anemia': 1 },
          '40-59': { 'Type 2 Diabetes (5A11)': 2, 'Osteoarthritis (FA01)': 1 },
          '60+': { 'Type 2 Diabetes (5A11)': 1, 'Osteoarthritis (FA01)': 1, 'Anemia': 1 }
        },
        'Type 2 Diabetes (5A11)': {
          '_total': { 'Hypertension (BA00)': 3 + Math.floor(Math.random() * 3), 'Vision Impairment': 1 },
          'Male': { 'Hypertension (BA00)': 2, 'Vision Impairment': 0 },
          'Female': { 'Hypertension (BA00)': 1, 'Vision Impairment': 1 },
          '40-59': { 'Hypertension (BA00)': 1, 'Vision Impairment': 0 },
          '60+': { 'Hypertension (BA00)': 2, 'Vision Impairment': 1 }
        }
      },
      avg_wait_times: {
        reg_to_vitals: 5 + Math.floor(Math.random() * 10),
        vitals_to_doc: 10 + Math.floor(Math.random() * 20),
        doc_to_pharmacy: 5 + Math.floor(Math.random() * 10)
      },
      ncd_metrics: {
        avg_sbp: 130 + Math.floor(Math.random() * 10),
        avg_dbp: 82 + Math.floor(Math.random() * 8),
        avg_glucose: 120 + Math.floor(Math.random() * 40)
      },
      maternal_health: {
        anc_visits: 2 + Math.floor(Math.random() * 6),
        high_risk_pregnancies: Math.floor(Math.random() * 2)
      },
      nutrition: {
        muac_green: 15 + Math.floor(Math.random() * 10),
        muac_yellow: 2 + Math.floor(Math.random() * 3),
        muac_red: Math.floor(Math.random() * 1.2)
      },
      infectious_disease: {
        tb_suspected_cases: Math.floor(Math.random() * 1.5)
      },
      medication_volumes: {
        'Amlodipine 5mg': 20 + Math.floor(Math.random() * 20),
        'Metformin 500mg': 15 + Math.floor(Math.random() * 15),
        'Paracetamol 500mg': 50 + Math.floor(Math.random() * 50)
      },
      provider_metrics: {
        consultations_per_doctor: {
          'Dr. Ahmed': 10 + Math.floor(Math.random() * 10),
          'Dr. Rahman': 8 + Math.floor(Math.random() * 12),
          'Dr. Islam': 5 + Math.floor(Math.random() * 15)
        },
        screenings_per_nurse: {
          'Nurse Fatima': 20 + Math.floor(Math.random() * 20),
          'Nurse Rabeya': 18 + Math.floor(Math.random() * 22)
        },
        dispensations_per_pharmacist: {
          'Pharm. Salim': 25 + Math.floor(Math.random() * 25),
          'Pharm. Nadia': 30 + Math.floor(Math.random() * 20)
        }
      },
      clinical_outcomes: {
        bp_controlled_rate: 65 + Math.random() * 15,
        glucose_controlled_rate: 45 + Math.random() * 20
      },
      operational_efficiency: {
        hourly_visit_distribution: {
          '08': 5 + Math.floor(Math.random() * 10),
          '09': 15 + Math.floor(Math.random() * 20),
          '10': 25 + Math.floor(Math.random() * 15),
          '11': 20 + Math.floor(Math.random() * 10),
          '12': 10 + Math.floor(Math.random() * 5),
          '13': 5 + Math.floor(Math.random() * 5),
          '14': 15 + Math.floor(Math.random() * 10)
        },
        avg_session_duration: {
          'doctor': 7 + Math.random() * 3,
          'vitals': 4 + Math.random() * 2,
          'pharmacy': 3 + Math.random() * 2
        }
      },
      cv_risk_metrics: {
        lab_based: {
          '<5%': 5 + Math.floor(Math.random() * 5),
          '5-10%': 3 + Math.floor(Math.random() * 4),
          '10-20%': 2 + Math.floor(Math.random() * 3),
          '20-30%': Math.floor(Math.random() * 2),
          '>=30%': Math.floor(Math.random() * 1.2)
        },
        non_lab_based: {
          '<5%': 8 + Math.floor(Math.random() * 7),
          '5-10%': 5 + Math.floor(Math.random() * 5),
          '10-20%': 3 + Math.floor(Math.random() * 4),
          '20-30%': 1 + Math.floor(Math.random() * 2),
          '>=30%': Math.floor(Math.random() * 1.5)
        }
      }
    }));
  }
  
  return data;
};
