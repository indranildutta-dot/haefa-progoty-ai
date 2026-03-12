import React from 'react';
import { Box, Typography, TextField, Chip, Grid, Divider, Paper } from '@mui/material';
import PrescriptionBuilder from './PrescriptionBuilder';
import { Prescription } from '../types';

interface ConsultationData {
  diagnosis: string;
  notes: string;
  treatmentNotes: string;
  prescriptions: Prescription[];
}

interface ConsultationPanelProps {
  data: ConsultationData;
  onChange: (data: ConsultationData) => void;
}

const COMMON_SYMPTOMS = ['Fever', 'Cough', 'Headache', 'Diarrhea', 'Vomiting', 'Abdominal pain'];

const ConsultationPanel: React.FC<ConsultationPanelProps> = ({ data, onChange }) => {
  const handleSymptomClick = (symptom: string) => {
    const newNotes = data.notes ? `${data.notes}, ${symptom}` : symptom;
    onChange({ ...data, notes: newNotes });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Section 1: Symptoms / Notes */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 1 — Symptoms / Notes
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

      {/* Section 2: Diagnosis */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 2 — Diagnosis
        </Typography>
        <TextField 
          fullWidth 
          variant="outlined" 
          placeholder="Enter primary diagnosis (e.g., Upper respiratory infection)" 
          value={data.diagnosis} 
          onChange={(e) => onChange({ ...data, diagnosis: e.target.value })} 
          sx={{ bgcolor: 'white', borderRadius: 2 }}
        />
      </Box>

      <Divider />

      {/* Section 3: Prescription Builder */}
      <Box>
        <PrescriptionBuilder 
          prescriptions={data.prescriptions} 
          onChange={(prescriptions) => onChange({ ...data, prescriptions })} 
        />
      </Box>

      <Divider />

      {/* Section 4: Treatment Notes */}
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
          Section 4 — Treatment Notes
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
