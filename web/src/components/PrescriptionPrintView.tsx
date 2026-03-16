import React from 'react';
import { Box, Typography, Divider, Grid } from '@mui/material';
import { Patient, Encounter, VitalsRecord, DiagnosisRecord, PrescriptionRecord, TriageAssessment } from '../types';

interface PrescriptionPrintViewProps {
  patient: Patient;
  encounter: Encounter;
  vitals: VitalsRecord | null;
  diagnosis: DiagnosisRecord | null;
  prescription: PrescriptionRecord | null;
  triage: TriageAssessment | null;
  countryCode: string;
  clinicName?: string;
}

const translateToBengaliNumerals = (text: string) => {
  if (!text) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return text.replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
};

const translateDosage = (dosage: string, frequency: string, duration: string, instructions: string, countryCode: string) => {
  if (countryCode === 'BD' || countryCode === 'bangladesh') {
    let translatedDuration = duration.replace(/days?/i, 'দিন').replace(/weeks?/i, 'সপ্তাহ').replace(/months?/i, 'মাস');
    translatedDuration = translateToBengaliNumerals(translatedDuration);
    
    let translatedDosage = translateToBengaliNumerals(dosage);
    let translatedFreq = translateToBengaliNumerals(frequency);

    return `${translatedDosage} - ${translatedFreq} - ${translatedDuration} - ${instructions}`;
  }
  return `${dosage} - ${frequency} - ${duration} - ${instructions}`;
};

const getLabels = (countryCode: string) => {
  const isBD = countryCode === 'BD' || countryCode === 'bangladesh';
  return {
    complaints: 'Complaints',
    oe: 'O/E',
    provisionalDx: 'Provisional Dx',
    labInvestigations: 'Lab Investigations',
    rx: 'Rx',
    advice: isBD ? 'Advice/পরামর্শ' : 'Advice',
    referral: isBD ? 'Referral/রেফারেল' : 'Referral',
    followUp: isBD ? 'Follow-up/পরবর্তী সাক্ষাৎ' : 'Follow-up',
    patientSummary: 'Patient Summary',
  };
};

const PrescriptionPrintView: React.FC<PrescriptionPrintViewProps> = ({
  patient,
  encounter,
  vitals,
  diagnosis,
  prescription,
  triage,
  countryCode,
  clinicName = "Health Clinic"
}) => {
  const labels = getLabels(countryCode);
  const dateStr = encounter.created_at ? new Date(encounter.created_at.toMillis()).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  return (
    <Box sx={{ width: '100%', bgcolor: 'white', color: 'black', p: 4, fontFamily: 'sans-serif' }} className="print-container">
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
        <img src="/logo.png" alt="HAEFA Logo" style={{ height: 60, marginRight: 16 }} />
        <Typography variant="h5" fontWeight="bold">Health and Education for All Prescription</Typography>
      </Box>
      <Divider sx={{ borderBottomWidth: 2, borderColor: 'black', mb: 2 }} />

      {/* Patient Info */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography><strong>Name:</strong> {patient.given_name} {patient.family_name}</Typography>
        <Typography><strong>Age:</strong> {patient.age_years || 0}</Typography>
        <Typography><strong>Gender:</strong> {patient.gender.toUpperCase()}</Typography>
        <Typography><strong>Date:</strong> {dateStr}</Typography>
      </Box>
      <Divider sx={{ borderBottomWidth: 2, borderColor: 'black', mb: 2 }} />

      {/* Main Content */}
      <Grid container spacing={0}>
        {/* Left Column */}
        <Grid item xs={4} sx={{ borderRight: '1px solid black', pr: 2 }}>
          {/* Complaints */}
          <Box sx={{ mb: 2 }}>
            <Typography fontWeight="bold" sx={{ borderBottom: '1px solid black', mb: 1 }}>{labels.complaints}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {diagnosis?.chief_complaint || triage?.chief_complaint || 'None recorded'}
            </Typography>
          </Box>

          {/* O/E (Vitals) */}
          <Box sx={{ mb: 2 }}>
            <Typography fontWeight="bold" sx={{ borderBottom: '1px solid black', mb: 1 }}>{labels.oe}</Typography>
            {vitals ? (
              <Box>
                {vitals.bmi && <Typography variant="body2">BMI: {vitals.bmi}</Typography>}
                <Typography variant="body2">BP: {vitals.systolic}/{vitals.diastolic} mmHg</Typography>
                {vitals.blood_sugar && <Typography variant="body2">Blood Sugar: {vitals.blood_sugar}</Typography>}
                {vitals.hemoglobin && <Typography variant="body2">Hemoglobin: {vitals.hemoglobin}</Typography>}
                <Typography variant="body2">Temp: {vitals.temperature} °C</Typography>
                <Typography variant="body2">HR: {vitals.heartRate} bpm</Typography>
              </Box>
            ) : (
              <Typography variant="body2">No vitals recorded</Typography>
            )}
          </Box>

          {/* Provisional Dx */}
          <Box sx={{ mb: 2 }}>
            <Typography fontWeight="bold" sx={{ borderBottom: '1px solid black', mb: 1 }}>{labels.provisionalDx}</Typography>
            <Typography variant="body2">{diagnosis?.diagnosis || 'None recorded'}</Typography>
          </Box>

          {/* Lab Investigations */}
          <Box sx={{ mb: 2 }}>
            <Typography fontWeight="bold" sx={{ borderBottom: '1px solid black', mb: 1 }}>{labels.labInvestigations}</Typography>
            {diagnosis?.labInvestigations && diagnosis.labInvestigations.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {diagnosis.labInvestigations.map((lab, i) => (
                  <li key={i}><Typography variant="body2">{lab}</Typography></li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2">None</Typography>
            )}
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={8} sx={{ pl: 2 }}>
          {/* Rx */}
          <Box sx={{ mb: 4 }}>
            <Typography fontWeight="bold" variant="h6" sx={{ mb: 1 }}>{labels.rx}</Typography>
            {prescription?.prescriptions && prescription.prescriptions.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                {prescription.prescriptions.map((rx, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    <Typography variant="body1">
                      {rx.medicationName} - {translateDosage(rx.dosage, rx.frequency, rx.duration, rx.instructions, countryCode)}
                    </Typography>
                  </li>
                ))}
              </ol>
            ) : (
              <Typography variant="body2">No medications prescribed</Typography>
            )}
          </Box>

          {/* Advice */}
          <Box sx={{ mb: 4 }}>
            <Typography fontWeight="bold" sx={{ mb: 1 }}>{labels.advice}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {diagnosis?.notes || 'None'}
            </Typography>
          </Box>

          {/* Referral */}
          <Box sx={{ mb: 4 }}>
            <Typography fontWeight="bold" sx={{ mb: 1 }}>{labels.referral}</Typography>
            {diagnosis?.referrals && diagnosis.referrals.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {diagnosis.referrals.map((ref, i) => (
                  <li key={i}><Typography variant="body2">{ref}</Typography></li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2">None</Typography>
            )}
          </Box>

          {/* Follow-up */}
          <Box sx={{ mb: 4 }}>
            <Typography fontWeight="bold" sx={{ mb: 1 }}>{labels.followUp}</Typography>
            <Typography variant="body2">Status: {encounter.status === 'COMPLETED' ? 'Completed' : 'In Progress'}</Typography>
          </Box>

          {/* Signature */}
          <Box sx={{ mt: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ textAlign: 'center', borderTop: '1px solid black', pt: 1, minWidth: '200px' }}>
              <Typography variant="body2">Doctor Signature</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Footer */}
      <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" display="block">{clinicName}</Typography>
        </Box>
      </Box>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-container, .print-container * {
              visibility: visible;
            }
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default PrescriptionPrintView;
