import React from 'react';
import { Box, Typography, Chip, Paper, Divider } from '@mui/material';
import { Patient, TriageAssessment } from '../types';
import PatientAllergies from './PatientAllergies';

interface PatientSummaryPanelProps {
  patient: Patient;
  triage: TriageAssessment | null;
}

const PatientSummaryPanel: React.FC<PatientSummaryPanelProps> = ({ patient, triage }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Basic Information
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Name:</strong> {patient.first_name} {patient.last_name}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Age/Gender:</strong> {patient.date_of_birth} / {patient.gender}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Village:</strong> {patient.village || 'N/A'}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Phone:</strong> {patient.phone || 'N/A'}</Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Known Allergies
        </Typography>
        {patient.id && <PatientAllergies patientId={patient.id} />}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Chronic Conditions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {triage?.chronic_diseases && triage.chronic_diseases.length > 0 ? (
            triage.chronic_diseases.map((disease, idx) => (
              <Chip key={idx} label={disease} size="small" variant="outlined" />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">None reported</Typography>
          )}
        </Box>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Lifestyle Indicators
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Tobacco:</strong> {triage?.tobacco_use || 'Unknown'}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Alcohol:</strong> {triage?.alcohol_use || 'Unknown'}</Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Chief Complaint
        </Typography>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="body2" fontStyle="italic">
            "{triage?.triage_notes || 'No complaint recorded'}"
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default PatientSummaryPanel;
