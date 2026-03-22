import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Paper, Divider, Alert } from '@mui/material';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient, TriageAssessment } from '../types';
import PatientAllergies from './PatientAllergies';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface PatientSummaryPanelProps {
  patient: Patient;
  triage: TriageAssessment | null;
}

const PatientSummaryPanel: React.FC<PatientSummaryPanelProps> = ({ patient, triage }) => {
  const [hasOwedMedication, setHasOwedMedication] = useState(false);

  useEffect(() => {
    if (!patient.id) return;
    const q = query(
      collection(db, "procurement_requests"),
      where("patient_id", "==", patient.id),
      where("status", "==", "PENDING_ORDER")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasOwedMedication(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [patient.id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {hasOwedMedication && (
        <Alert 
          severity="error" 
          icon={<ErrorOutlineIcon />}
          sx={{ 
            borderRadius: 2, 
            fontWeight: 800, 
            border: '2px solid', 
            borderColor: 'error.main',
            animation: 'pulse 2s infinite'
          }}
        >
          OWED MEDICATION: This patient has pending IOUs from previous visits.
          <style>
            {`
              @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
              }
            `}
          </style>
        </Alert>
      )}

      <Box>
        <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          Basic Information
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Name:</strong> {patient.given_name} {patient.family_name}</Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Age/Gender:</strong> {patient.age_years !== undefined ? `${patient.age_years} YRS` : patient.date_of_birth} / {patient.gender}</Typography>
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
