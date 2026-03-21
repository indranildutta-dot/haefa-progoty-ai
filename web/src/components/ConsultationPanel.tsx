import React from 'react';
import { Box, Typography, TextField, Chip, Grid, Divider, Paper, Autocomplete } from '@mui/material';
import PrescriptionBuilder from './PrescriptionBuilder';
import ClinicalAssessmentPanel, { ClinicalAssessmentData, initialClinicalAssessment } from './ClinicalAssessmentPanel';
import { Prescription } from '../types';

export interface ConsultationData {
  diagnosis: string;
  notes: string;
  treatmentNotes: string;
  prescriptions: Prescription[];
  clinicalAssessment: ClinicalAssessmentData;
  labInvestigations: string[];
  referrals: string[];
}

interface ConsultationPanelProps {
  data: ConsultationData;
  onChange: (data: ConsultationData) => void;
}

const COMMON_SYMPTOMS = ['Fever', 'Cough', 'Headache', 'Diarrhea', 'Vomiting', 'Abdominal pain'];
const COMMON_LABS = ['Complete Blood Count (CBC)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Lipid Profile', 'Urine Routine', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)', 'X-Ray Chest', 'ECG', 'Ultrasound Abdomen'];
const COMMON_REFERRALS = ['Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology', 'Ophthalmology', 'ENT', 'Gynecology'];

const ConsultationPanel: React.FC<ConsultationPanelProps> = ({ data, onChange }) => {
  const handleSymptomClick = (symptom: string) => {
    const newNotes = data.notes ? `${data.notes}, ${symptom}` : symptom;
    onChange({ ...data, notes: newNotes });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Section 1: Clinical Assessment */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 1 — Clinical Assessment
        </Typography>
        <ClinicalAssessmentPanel 
          data={data.clinicalAssessment || initialClinicalAssessment} 
          onChange={(clinicalAssessment) => onChange({ ...data, clinicalAssessment })} 
        />
      </Box>

      <Divider />

      {/* Section 2: Symptoms / Notes */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 2 — Symptoms / Notes
        </Typography>
        <TextField 
          fullWidth 
          multiline 
          rows={3} 
          variant="outlined" 
          placeholder="Enter patient symptoms and clinical notes..." 
          value={data.notes} 
          onChange={(e) => onChange({ ...data, notes: e.target.value })} 
          sx={{ mb: 2, bgcolor: 'white', borderRadius: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center', mr: 1, fontWeight: 'bold' }}>Quick Add:</Typography>
          {COMMON_SYMPTOMS.map((symptom) => (
            <Chip 
              key={symptom} 
              label={symptom} 
              onClick={() => handleSymptomClick(symptom)} 
              size="small" 
              variant="outlined" 
              color="primary" 
              sx={{ fontWeight: 600, borderRadius: 1 }}
            />
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Section 3: Provisional Diagnosis */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 3 — Provisional Diagnosis
        </Typography>
        <TextField 
          fullWidth 
          variant="outlined" 
          placeholder="Enter provisional diagnosis (e.g., Upper respiratory infection)" 
          value={data.diagnosis} 
          onChange={(e) => onChange({ ...data, diagnosis: e.target.value })} 
          sx={{ bgcolor: 'white', borderRadius: 2 }}
        />
      </Box>

      <Divider />

      {/* Section 4: Prescribed Medicines */}
      <Box>
        <PrescriptionBuilder 
          prescriptions={data.prescriptions} 
          onChange={(prescriptions) => onChange({ ...data, prescriptions })} 
        />
      </Box>

      <Divider />

      {/* Section 5: Lab Investigations */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 5 — Lab Investigations
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          options={COMMON_LABS}
          value={data.labInvestigations || []}
          onChange={(event, newValue) => {
            onChange({ ...data, labInvestigations: newValue });
          }}
          renderTags={(value: readonly string[], getTagProps) =>
            value.map((option: string, index: number) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip variant="outlined" label={option} key={key} {...tagProps} color="primary" sx={{ fontWeight: 600, borderRadius: 1 }} />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder="Add lab tests..."
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            />
          )}
        />
      </Box>

      <Divider />

      {/* Section 6: Referral Section */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 6 — Referral Section
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          options={COMMON_REFERRALS}
          value={data.referrals || []}
          onChange={(event, newValue) => {
            onChange({ ...data, referrals: newValue });
          }}
          renderTags={(value: readonly string[], getTagProps) =>
            value.map((option: string, index: number) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip variant="outlined" label={option} key={key} {...tagProps} color="secondary" sx={{ fontWeight: 600, borderRadius: 1 }} />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder="Add referrals..."
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            />
          )}
        />
      </Box>

      <Divider />

      {/* Section 7: Treatment Notes */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 7 — Treatment Notes
        </Typography>
        <TextField 
          fullWidth 
          multiline 
          rows={2} 
          variant="outlined" 
          placeholder="Optional instructions (e.g., Increase fluids, Return if fever persists 3 days)" 
          value={data.treatmentNotes} 
          onChange={(e) => onChange({ ...data, treatmentNotes: e.target.value })} 
          sx={{ bgcolor: 'white', borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
};

export default ConsultationPanel;
