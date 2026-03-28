import React, { useState } from 'react';
import { 
  Box, Typography, TextField, Chip, Divider, Button, 
  Autocomplete, Stack, CircularProgress, Alert, Paper 
} from '@mui/material'; // <--- MUST INCLUDE Paper HERE
import PrescriptionBuilder from './PrescriptionBuilder';
import ClinicalAssessmentPanel, { ClinicalAssessmentData, initialClinicalAssessment } from './ClinicalAssessmentPanel';
import { Prescription } from '../types';
import { saveConsultation } from '../services/encounterService';
import { useAppStore } from '../store/useAppStore';

// Icons
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';

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
  patientId: string;
  encounterId: string;
  data: ConsultationData;
  onChange: (data: ConsultationData) => void;
  onComplete?: () => void;
}

const COMMON_SYMPTOMS = ['Fever', 'Cough', 'Headache', 'Diarrhea', 'Vomiting', 'Abdominal pain'];
const COMMON_LABS = ['Complete Blood Count (CBC)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Lipid Profile', 'Urine Routine', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)', 'X-Ray Chest', 'ECG', 'Ultrasound Abdomen'];
const COMMON_REFERRALS = ['Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology', 'Ophthalmology', 'ENT', 'Gynecology'];

const ConsultationPanel: React.FC<ConsultationPanelProps> = ({ 
  patientId, 
  encounterId, 
  data, 
  onChange, 
  onComplete 
}) => {
  const { notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSymptomClick = (symptom: string) => {
    const newNotes = data.notes ? `${data.notes}, ${symptom}` : symptom;
    onChange({ ...data, notes: newNotes });
  };

  const handleFinalizeConsultation = async () => {
    if (!data.diagnosis) {
      notify("Provisional Diagnosis is required before finalizing.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveConsultation(
        {
          encounter_id: encounterId,
          patient_id: patientId,
          diagnosis: data.diagnosis,
          notes: data.notes,
          treatment_notes: data.treatmentNotes,
          lab_investigations: data.labInvestigations,
          referrals: data.referrals,
          assessment: data.clinicalAssessment
        },
        {
          encounter_id: encounterId,
          patient_id: patientId,
          prescriptions: data.prescriptions
        }
      );

      notify("Consultation finalized. Patient moved to Pharmacy queue.", "success");
      
      if (onComplete) onComplete();
      
    } catch (error: any) {
      console.error("Finalization Error:", error);
      notify("Failed to finalize consultation. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRequisitions = data.prescriptions.some(p => p.isRequisition);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="textSecondary" sx={{ mr: 1, fontWeight: 'bold' }}>Quick Add:</Typography>
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
          initialData={data.prescriptions} 
          onPrescriptionChange={(prescriptions) => onChange({ ...data, prescriptions })} 
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
          onChange={(_, newValue) => onChange({ ...data, labInvestigations: newValue })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip variant="outlined" label={option} key={key} {...tagProps} color="primary" sx={{ fontWeight: 600, borderRadius: 1 }} />
              );
            })
          }
          renderInput={(params) => (
            <TextField {...params} variant="outlined" placeholder="Add lab tests..." sx={{ bgcolor: 'white', borderRadius: 2 }} />
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
          onChange={(_, newValue) => onChange({ ...data, referrals: newValue })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip variant="outlined" label={option} key={key} {...tagProps} color="secondary" sx={{ fontWeight: 600, borderRadius: 1 }} />
              );
            })
          }
          renderInput={(params) => (
            <TextField {...params} variant="outlined" placeholder="Add referrals..." sx={{ bgcolor: 'white', borderRadius: 2 }} />
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
          placeholder="General patient instructions (e.g., Increase fluids, Return if fever persists)" 
          value={data.treatmentNotes} 
          onChange={(e) => onChange({ ...data, treatmentNotes: e.target.value })} 
          sx={{ bgcolor: 'white', borderRadius: 2 }}
        />
      </Box>

      {/* --- FINALIZE FOOTER --- */}
      <Paper 
        elevation={10} 
        sx={{ 
          position: 'fixed', bottom: 0, left: 0, right: 0, 
          p: 3, bgcolor: 'background.paper', borderTop: '1px solid #eee',
          zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}
      >
        <Stack direction="row" spacing={3} alignItems="center" sx={{ width: '100%', maxWidth: 1200 }}>
          <Box sx={{ flexGrow: 1 }}>
            {hasRequisitions ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <strong>Requisition Detected:</strong> Some items are not in stock. Finalizing will create a procurement order.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                <InfoIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">Ensure all clinical data is accurate before sending to Pharmacy.</Typography>
              </Box>
            )}
          </Box>
          
          <Button
            variant="contained"
            size="large"
            color="primary"
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            onClick={handleFinalizeConsultation}
            disabled={isSubmitting || !data.diagnosis}
            sx={{ 
              height: 56, px: 6, borderRadius: 3, fontWeight: 900, fontSize: '1.1rem',
              boxShadow: '0 8px 24px rgba(25, 118, 210, 0.3)'
            }}
          >
            {isSubmitting ? "FINALIZING..." : "FINALIZE & SEND TO PHARMACY"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ConsultationPanel;