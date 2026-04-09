import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, TextField, Chip, Divider, Button, 
  Autocomplete, Stack, CircularProgress, Alert, Paper 
} from '@mui/material';
import * as ECT from '@whoicd/icd11ect';
import '@whoicd/icd11ect/style.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
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
  const { notify, selectedClinic, userProfile } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Local state buffer to ensure smooth typing and selection
  const [localData, setLocalData] = useState<ConsultationData>(data);
  const icdInputRef = useRef<HTMLInputElement>(null);

  // Initialize ICD-11 ECT
  useEffect(() => {
    const settings = {
      apiServerUrl: "https://id.who.int",
      apiLinearization: "mms",
      getNewTokenFunction: async () => {
        try {
          const getIcdToken = httpsCallable(functions, 'getIcdToken');
          const result: any = await getIcdToken();
          return result.data.access_token;
        } catch (error) {
          console.error("Failed to get ICD token:", error);
          return "";
        }
      }
    };

    const callbacks = {
      selectedEntityFunction: (selectedEntity: any) => {
        if (selectedEntity) {
          // Capture code and URI as requested
          const diagnosisString = `${selectedEntity.code} - ${selectedEntity.bestMatchText}`;
          handleLocalChange({ 
            diagnosis: diagnosisString,
            // We can also store the URI in notes or a hidden field if needed, 
            // but for now we follow the instruction to populate the Diagnosis field.
          });
          // Clear the search tool after selection
          ECT.Handler.clear("1");
        }
      }
    };

    // Configure the ECT handler
    ECT.Handler.configure(settings, callbacks);
  }, []);

  // Sync with parent when encounter changes
  useEffect(() => {
    setLocalData(data);
  }, [encounterId]);

  const handleLocalChange = (updates: Partial<ConsultationData>) => {
    const updated = { ...localData, ...updates };
    setLocalData(updated);
    onChange(updated); // Sync back to the parent app state
  };

  const handleFinalize = async () => {
    if (!localData.diagnosis) {
      notify("Provisional Diagnosis is required.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveConsultation(
        {
          encounter_id: encounterId,
          patient_id: patientId,
          diagnosis: localData.diagnosis,
          notes: localData.notes,
          treatment_notes: localData.treatmentNotes,
          labInvestigations: localData.labInvestigations,
          referrals: localData.referrals,
          assessment: localData.clinicalAssessment
        },
        {
          encounter_id: encounterId,
          patient_id: patientId,
          prescriptions: localData.prescriptions
        }
      );

      notify("Consultation finalized successfully.", "success");
      if (onComplete) onComplete();
      
    } catch (error: any) {
      console.error("Save Error:", error);
      notify("Failed to finalize consultation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRequisitions = localData.prescriptions.some(p => p.isRequisition);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, pb: 12 }}>
      {/* Section 1: Assessment */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 1 — Clinical Assessment</Typography>
        <ClinicalAssessmentPanel 
          data={localData.clinicalAssessment || initialClinicalAssessment} 
          onChange={(val) => handleLocalChange({ clinicalAssessment: val })} 
        />
      </Box>

      <Divider />

      {/* Section 2: Notes */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 2 — Symptoms / Notes</Typography>
        <TextField 
          fullWidth multiline rows={3} variant="outlined" 
          value={localData.notes || ""} 
          onChange={(e) => handleLocalChange({ notes: e.target.value })} 
          placeholder="Enter symptoms..." 
          sx={{ mb: 2, bgcolor: 'white', borderRadius: 2 }}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {COMMON_SYMPTOMS.map(s => (
            <Chip key={s} label={s} onClick={() => handleLocalChange({ notes: localData.notes ? `${localData.notes}, ${s}` : s })} size="small" variant="outlined" color="primary" />
          ))}
        </Stack>
      </Box>

      <Divider />

      {/* Section 3: Diagnosis (ICD-11 Integrated) */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>
          Section 3 — Provisional Diagnosis (ICD-11)
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <TextField 
            fullWidth 
            variant="outlined" 
            value={localData.diagnosis || ""} 
            onChange={(e) => handleLocalChange({ diagnosis: e.target.value })} 
            placeholder="Search ICD-11 Diagnosis..." 
            inputProps={{ 
              "data-ctw-ino": "1",
              autoComplete: "off"
            }}
            sx={{ 
              bgcolor: 'white', 
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#e2e8f0' },
                '&:hover fieldset': { borderColor: '#3b82f6' },
              }
            }}
          />
          {/* WHO ECT Search Results Window */}
          <Box 
            className="ctw-window" 
            data-ctw-ino="1" 
            sx={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0, 
              right: 0, 
              zIndex: 2000,
              bgcolor: 'white',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              borderRadius: '0 0 8px 8px',
              border: '1px solid #e2e8f0',
              borderTop: 'none',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          />
        </Box>
      </Box>

      <Divider />

      {/* Section 4: Prescription Builder */}
      <PrescriptionBuilder 
        initialData={localData.prescriptions} 
        onPrescriptionChange={(prescriptions) => handleLocalChange({ prescriptions })} 
      />

      <Divider />

      {/* Section 5: Lab Investigations (Fixed multiple selection) */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 5 — Lab Investigations</Typography>
        <Autocomplete
          multiple options={COMMON_LABS} freeSolo
          value={localData.labInvestigations || []}
          onChange={(_, newValue) => handleLocalChange({ labInvestigations: newValue })}
          renderTags={(value, getTagProps) => value.map((option, index) => <Chip label={option} {...getTagProps({ index })} color="primary" size="small" />)}
          renderInput={(params) => <TextField {...params} variant="outlined" placeholder="Select Lab Tests..." sx={{ bgcolor: 'white' }} />}
        />
      </Box>

      <Divider />

      {/* Section 6: Referrals (Fixed multiple selection) */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 6 — Referral Section</Typography>
        <Autocomplete
          multiple options={COMMON_REFERRALS} freeSolo
          value={localData.referrals || []}
          onChange={(_, newValue) => handleLocalChange({ referrals: newValue })}
          renderTags={(value, getTagProps) => value.map((option, index) => <Chip label={option} {...getTagProps({ index })} color="secondary" size="small" />)}
          renderInput={(params) => <TextField {...params} variant="outlined" placeholder="Add Referrals..." sx={{ bgcolor: 'white' }} />}
        />
      </Box>

      <Divider />

      {/* Section 7: Treatment Notes (Fixed typing) */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 7 — Treatment Notes</Typography>
        <TextField 
          fullWidth multiline rows={2} variant="outlined" 
          value={localData.treatmentNotes || ""} 
          onChange={(e) => handleLocalChange({ treatmentNotes: e.target.value })} 
          placeholder="Instructions for the patient..." 
          sx={{ bgcolor: 'white', borderRadius: 2 }}
        />
      </Box>

      {/* Prescriber Identification Block */}
      <Box sx={{ mt: 2, p: 3, bgcolor: '#f1f5f9', borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 1.5 }}>
          Prescriber Identification
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
            - {userProfile?.name || 'Unknown Doctor'}, {userProfile?.designation || 'Medical Officer'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
            {userProfile?.professional_body || 'BMDC'} Reg No: {userProfile?.professional_reg_no || 'PENDING'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
            Clinic: {selectedClinic?.name} | Date: {new Date().toLocaleDateString()}
          </Typography>
        </Box>
      </Box>

      {/* Footer Button */}
      <Paper elevation={10} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 3, zIndex: 1000 }}>
        <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
          <Box sx={{ flexGrow: 1, maxWidth: 600 }}>
            {hasRequisitions && <Alert severity="warning">Note: Items out of stock will trigger procurement requisitions.</Alert>}
          </Box>
          <Button
            variant="contained" size="large" onClick={handleFinalize} 
            disabled={isSubmitting || !localData.diagnosis}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            sx={{ height: 56, px: 6, borderRadius: 3, fontWeight: 900 }}
          >
            {isSubmitting ? "SAVING..." : "FINALIZE & SEND TO PHARMACY"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ConsultationPanel;