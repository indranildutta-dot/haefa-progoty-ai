import React, { useEffect, useState } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Paper, Divider, 
  Stack, Chip, CircularProgress, Alert
} from '@mui/material';
import QRCode from 'react-qr-code';
import dayjs from 'dayjs';
import { 
  getEncounterById, 
  getVitalsByEncounter, 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter 
} from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { 
  Patient, 
  Encounter, 
  VitalsRecord, 
  DiagnosisRecord, 
  PrescriptionRecord 
} from '../types';
import { useAppStore } from '../store/useAppStore';
import { calculateAgeDisplay } from '../utils/patient';

interface PrescriptionPrintTemplateProps {
  encounterId: string;
  onReady?: () => void;
}

const PrescriptionPrintTemplate: React.FC<PrescriptionPrintTemplateProps> = ({ encounterId, onReady }) => {
  const { selectedClinic } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    patient: Patient;
    encounter: Encounter;
    vitals: VitalsRecord | null;
    diagnosis: DiagnosisRecord | null;
    prescription: PrescriptionRecord | null;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const encounter = await getEncounterById(encounterId);
        if (!encounter) throw new Error("Encounter not found");

        const [patient, vitals, diagnosis, prescription] = await Promise.all([
          getPatientById(encounter.patient_id),
          getVitalsByEncounter(encounterId),
          getDiagnosisByEncounter(encounterId),
          getPrescriptionByEncounter(encounterId)
        ]);

        setData({ patient, encounter, vitals, diagnosis, prescription });
        setLoading(false);
        if (onReady) onReady();
      } catch (err: any) {
        console.error("Print Data Fetch Error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [encounterId]);

  if (loading) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>Preparing Prescription for Print...</Typography>
    </Box>
  );

  if (error || !data) return (
    <Alert severity="error" sx={{ m: 2 }}>
      Error loading prescription data: {error || "Unknown error"}
    </Alert>
  );

  const { patient, encounter, vitals, diagnosis, prescription } = data;

  const getTriageColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return '#ef4444';
      case 'urgent': return '#f97316';
      case 'standard': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#64748b';
    }
  };

  const formattedDate = (ts: any) => {
    // Robust Fallback: Fallback to current local date if no timestamp is provided
    if (!ts) return dayjs().format('DD MMM YYYY, hh:mm A');
    try {
      // 1. Native dayjs/Date
      if (dayjs.isDayjs(ts)) return ts.format('DD MMM YYYY, hh:mm A');
      if (ts instanceof Date) return dayjs(ts).format('DD MMM YYYY, hh:mm A');

      // 2. Specialized parsing
      let date: Date | null = null;
      
      if (ts && typeof ts === 'object') {
        if (typeof ts.toDate === 'function') {
          date = ts.toDate();
        } else if (typeof ts.toMillis === 'function') {
          date = new Date(ts.toMillis());
        } else if (ts.seconds !== undefined) {
          date = new Date(ts.seconds * 1000);
        } else if (ts._seconds !== undefined) {
          date = new Date(ts._seconds * 1000);
        } else if (ts.seconds_ !== undefined) { // Common in some serialization
          date = new Date(ts.seconds_ * 1000);
        }
      } else if (typeof ts === 'number') {
        date = new Date(ts);
      } else if (typeof ts === 'string') {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) date = d;
      }

      if (date && !isNaN(date.getTime())) {
        return dayjs(date).format('DD MMM YYYY, hh:mm A');
      }

      // 3. Fallback to general dayjs
      const parsed = dayjs(ts);
      if (parsed.isValid() && parsed.year() > 1900) {
        return parsed.format('DD MMM YYYY, hh:mm A');
      }

      return '-';
    } catch (e) {
      console.error("Format Date Error:", e, ts);
      return '-';
    }
  };

  return (
    <Box id="prescription-print-area" sx={{ 
      p: 4, 
      bgcolor: 'white', 
      minHeight: '297mm', 
      width: '210mm', 
      mx: 'auto', 
      color: 'black',
      '@media print': {
        p: 0,
        m: 0,
        width: '100%',
        minHeight: 'auto',
        boxShadow: 'none',
        '.MuiBox-root': { boxShadow: 'none' }
      }
    }}>
      <style>
        {`
          @media print {
            body { 
              visibility: hidden; 
              background: white !important;
            }
            #prescription-print-area, #prescription-print-area * { 
              visibility: visible; 
            }
            #prescription-print-area { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%;
              padding: 0 !important;
              margin: 0 !important;
            }
            @page {
              size: auto;
              margin: 15mm;
            }
          }
        `}
      </style>
      {/* Header: Trust Signals */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Grid size={{ xs: 2 }}>
          <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCode value={patient.id} size={80} style={{ width: '100%', height: '100%' }} />
          </Box>
        </Grid>
        <Grid size={{ xs: 7 }} sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h6" 
            fontWeight="900" 
            sx={{ 
              textTransform: 'uppercase', 
              letterSpacing: '-0.03em', 
              color: '#800000', 
              whiteSpace: 'nowrap',
              fontSize: '1.15rem',
              lineHeight: 1.1
            }}
          >
            HEALTH AND EDUCATION FOR ALL
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight="700">
            Clinic: {selectedClinic?.name || "Dhaka"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedClinic?.address || "Rural Health Center, Bangladesh"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contact: +880 1XXX-XXXXXX | Email: info@haefa.org
          </Typography>
        </Grid>
        <Grid size={{ xs: 3 }} sx={{ textAlign: 'right' }}>
          <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ display: 'block' }}>ENCOUNTER ID</Typography>
          <Typography variant="h6" fontWeight="900" color="primary">#{encounterId.slice(-8).toUpperCase()}</Typography>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3, borderBottomWidth: 2 }} />

      {/* Patient Banner */}
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 5 }}>
              <Typography variant="caption" fontWeight="900" color="text.secondary">PATIENT NAME</Typography>
              <Typography variant="h6" fontWeight="900">{patient.given_name} {patient.family_name}</Typography>
            </Grid>
            <Grid size={{ xs: 3 }}>
              <Typography variant="caption" fontWeight="900" color="text.secondary">AGE / SEX</Typography>
              <Typography variant="body1" fontWeight="700">
                {calculateAgeDisplay(patient)} / {patient.gender?.toUpperCase().charAt(0)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
              <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ display: 'block' }}>DATE / TIME</Typography>
              <Typography variant="body2" fontWeight="700">
                {formattedDate(prescription?.created_at || (prescription as any)?.createdAt || encounter.created_at || (encounter as any)?.createdAt)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Clinical Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 1, textTransform: 'uppercase' }}>Clinical Assessment</Typography>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minHeight: 120 }}>
            <Typography variant="body2" sx={{ mb: 1 }}><strong>Complaints:</strong> {diagnosis?.chief_complaint || diagnosis?.notes || "None recorded"}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>O/E:</strong> 
              {vitals ? ` BP: ${vitals.systolic}/${vitals.diastolic} mmHg, HR: ${vitals.heartRate} bpm, Temp: ${vitals.temperature}°C, SpO2: ${vitals.oxygenSaturation}%` : " No vitals recorded"}
            </Typography>
            {!!vitals?.blood_sugar && (
              <Typography variant="body2"><strong>Blood Sugar:</strong> {vitals.blood_sugar} mg/dL</Typography>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 1, textTransform: 'uppercase' }}>Provisional Diagnosis</Typography>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', bgcolor: '#fff7ed' }}>
            <Typography variant="h6" fontWeight="900" color="#9a3412" sx={{ textAlign: 'center' }}>
              {diagnosis?.diagnosis || "Pending Finalization"}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Medication Table */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 1, textTransform: 'uppercase' }}>Prescribed Medications (Rx)</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 900 }}>Drug Name</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Dosage</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Instructions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescription?.prescriptions.map((med, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ fontWeight: 700 }}>{med.medicationName}</TableCell>
                  <TableCell>{med.dosageValue}{med.dosageUnit}</TableCell>
                  <TableCell>{med.frequencyValue}x {med.frequencyUnit}</TableCell>
                  <TableCell>{med.durationValue} {med.durationUnit}</TableCell>
                  <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>{med.instructions}</TableCell>
                </TableRow>
              ))}
              {(!prescription || prescription.prescriptions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No medications prescribed.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Footer Sections */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 7 }}>
          <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 1, textTransform: 'uppercase' }}>Advice & Referrals</Typography>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 100 }}>
            <Typography variant="body2" sx={{ mb: 1 }}><strong>Treatment Notes:</strong> {diagnosis?.treatment_notes || "Follow standard care."}</Typography>
            {diagnosis?.referrals && diagnosis.referrals.length > 0 && (
              <Typography variant="body2" sx={{ mb: 1 }}><strong>Referrals:</strong> {diagnosis.referrals.join(', ')}</Typography>
            )}
            {diagnosis?.labInvestigations && diagnosis.labInvestigations.length > 0 && (
              <Typography variant="body2"><strong>Labs:</strong> {diagnosis.labInvestigations.join(', ')}</Typography>
            )}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2"><strong>Follow-up Date:</strong> ____________________</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 5 }}>
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Box sx={{ borderBottom: '1px solid black', width: '80%', mx: 'auto', mb: 1, height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Typography 
                variant="h5" 
                color="primary"
                sx={{ 
                  fontFamily: '"Caveat", "Brush Script MT", "Lucida Handwriting", cursive', 
                  transform: 'rotate(-2deg) translateY(4px)',
                  fontWeight: 700 
                }}
              >
                {diagnosis?.prescriber_name || "Medical Officer"}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight="900">{diagnosis?.prescriber_name || "Medical Officer"}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {diagnosis?.prescriber_designation || "Medical Officer"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {diagnosis?.prescriber_body || "BMDC"} Reg No: {diagnosis?.prescriber_reg_no || "N/A"}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Dispensing Summary (Only if dispensed) */}
      {prescription?.status === 'DISPENSED' && (
        <Box sx={{ mt: 4, pt: 4, borderTop: '2px dashed #cbd5e1' }}>
          <Typography variant="subtitle2" fontWeight="900" color="secondary" sx={{ mb: 2, textTransform: 'uppercase' }}>Dispensing Summary (Pharmacy)</Typography>
          <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f0f9ff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>Medication</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Mode</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Dispensed Qty</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Substitution / Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prescription.dispensation_details?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 700 }}>{item.medication}</TableCell>
                      <TableCell>
                        <Chip label={item.mode} size="small" color={item.mode === 'FULL' ? 'success' : 'warning'} sx={{ fontWeight: 800, height: 20 }} />
                      </TableCell>
                      <TableCell>{item.dispensed}</TableCell>
                      <TableCell>
                        {item.substitution && <Typography variant="caption" display="block"><b>Sub:</b> {item.substitution}</Typography>}
                        {item.substitution_reason && <Typography variant="caption" display="block"><b>Reason:</b> {item.substitution_reason}</Typography>}
                        {item.return_on && <Typography variant="caption" color="error" fontWeight="900">Return on: {new Date(item.return_on).toLocaleDateString()}</Typography>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <Grid container spacing={2} sx={{ mt: 3 }}>
                <Grid size={{ xs: 7 }}>
                  <Typography variant="body2" color="text.secondary">
                    Dispensed at: {formattedDate(prescription.updated_at || (prescription as any)?.updatedAt)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 5 }} sx={{ textAlign: 'center' }}>
                  <Box sx={{ borderBottom: '1px solid black', width: '80%', mx: 'auto', mb: 1, height: 30 }} />
                  <Typography variant="body2" fontWeight="900">{prescription.dispenser_name || "Pharmacist"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {prescription.dispenser_body || "PCB"} Reg No: {prescription.dispenser_reg_no || "N/A"}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Print Footer */}
      <Box sx={{ mt: 'auto', pt: 4, textAlign: 'center', opacity: 0.5 }}>
        <Typography variant="caption">
          This is a computer-generated prescription from HAEFA Clinical Registry. 
          Generated on: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionPrintTemplate;
