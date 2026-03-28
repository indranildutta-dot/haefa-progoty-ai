import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  Chip,
  IconButton
} from '@mui/material';
import { 
  getPatientHistory,
  getVitalsByEncounter, 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter 
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { getPatientById } from '../services/patientService';
import { Encounter, VitalsRecord, DiagnosisRecord, PrescriptionRecord, TriageAssessment, Patient } from '../types';
import PrescriptionPrintView from './PrescriptionPrintView';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import WineBarIcon from '@mui/icons-material/WineBar';
import { useAppStore } from '../store/useAppStore';

interface PatientHistoryTimelineProps {
  patientId: string;
}

interface HistoryItem {
  encounter: Encounter;
  vitals: VitalsRecord | null;
  diagnosis: DiagnosisRecord | null;
  prescription: PrescriptionRecord | null;
  triage: TriageAssessment | null;
}

const PatientHistoryTimeline: React.FC<PatientHistoryTimelineProps> = ({ patientId }) => {
  const { selectedCountry, selectedClinic } = useAppStore();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [fullHistoryItems, setFullHistoryItems] = useState<HistoryItem[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [openFullHistory, setOpenFullHistory] = useState(false);
  const [printItem, setPrintItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [encounters, patientData] = await Promise.all([
          getPatientHistory(patientId),
          getPatientById(patientId)
        ]);
        setPatient(patientData);
        const completedEncounters = encounters.filter(e => e.encounter_status === 'COMPLETED');
        
        const items = await Promise.all(completedEncounters.slice(0, 5).map(async (encounter) => {
          const [vitals, diagnosis, prescription, triage] = await Promise.all([
            getVitalsByEncounter(encounter.id!),
            getDiagnosisByEncounter(encounter.id!),
            getPrescriptionByEncounter(encounter.id!),
            getTriageAssessmentByEncounter(encounter.id!)
          ]);
          return { encounter, vitals, diagnosis, prescription, triage };
        }));
        
        setHistoryItems(items);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) fetchHistory();
  }, [patientId]);

  const handleViewFullHistory = async () => {
    setOpenFullHistory(true);
    if (fullHistoryItems.length > 0) return; 
    setLoadingFull(true);
    try {
      const encounters = await getPatientHistory(patientId);
      const completedEncounters = encounters.filter(e => e.encounter_status === 'COMPLETED');
      const items = await Promise.all(completedEncounters.map(async (encounter) => {
        const [vitals, diagnosis, prescription, triage] = await Promise.all([
          getVitalsByEncounter(encounter.id!),
          getDiagnosisByEncounter(encounter.id!),
          getPrescriptionByEncounter(encounter.id!),
          getTriageAssessmentByEncounter(encounter.id!)
        ]);
        return { encounter, vitals, diagnosis, prescription, triage };
      }));
      setFullHistoryItems(items);
    } catch (err) {
      console.error("Error fetching full history:", err);
    } finally {
      setLoadingFull(false);
    }
  };

  const handlePrint = (item: HistoryItem) => {
    setPrintItem(item);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintItem(null), 1000);
    }, 100);
  };

  const renderRiskChips = (v: any) => {
    if (!v) return null;
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
        {v.is_pregnant === 'yes' && (
          <Chip size="small" icon={<ErrorIcon sx={{ fontSize: '14px !important' }}/>} label="PREGNANT" sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900 }} />
        )}
        {v.allergies && v.allergies.toLowerCase() !== 'none' && (
          <Chip size="small" icon={<WarningIcon sx={{ fontSize: '14px !important' }}/>} label="ALLERGIES" sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900 }} />
        )}
        {v.tobacco_use && v.tobacco_use !== 'none' && (
          <Chip 
            size="small" 
            icon={<SmokingRoomsIcon sx={{ fontSize: '14px !important' }}/>} 
            label={v.tobacco_use === 'chewing' || v.tobacco_use === 'both' ? "GUTKHA/PAN" : "TOBACCO"} 
            sx={{ bgcolor: '#92400e', color: 'white', fontWeight: 900 }} 
          />
        )}
        {v.alcohol_consumption && v.alcohol_consumption !== 'none' && (
          <Chip size="small" icon={<WineBarIcon sx={{ fontSize: '14px !important' }}/>} label="ALCOHOL" sx={{ bgcolor: '#7c2d12', color: 'white', fontWeight: 900 }} />
        )}
      </Stack>
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>;

  return (
    <Box>
      <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2, display: 'flex', alignItems: 'center' }}>
        <HistoryIcon sx={{ mr: 1, fontSize: 18 }} /> Clinical History
      </Typography>
      
      {historyItems.map((item) => (
        <Card key={item.encounter.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', transition: '0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }}>
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle2" fontWeight="900" color="text.secondary">
                {item.encounter.created_at?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Typography>
              <IconButton size="small" onClick={() => handlePrint(item)} sx={{ bgcolor: '#f1f5f9' }}>
                <LocalPrintshopIcon fontSize="small" />
              </IconButton>
            </Box>
            
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b', mb: 0.5 }}>
              Diagnosis: {item.diagnosis?.diagnosis || 'General Consultation'}
            </Typography>
            
            {renderRiskChips(item.vitals)}
            
            <Box sx={{ mt: 1.5, display: 'flex', gap: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                BP: <strong>{item.vitals?.systolic}/{item.vitals?.diastolic}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                SpO2: <strong>{item.vitals?.oxygenSaturation}%</strong>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}

      <Button variant="outlined" fullWidth onClick={handleViewFullHistory} sx={{ mt: 1, borderRadius: 2, fontWeight: 900, py: 1.2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}>
        View Full Medical Record
      </Button>

      <Dialog open={openFullHistory} onClose={() => setOpenFullHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, bgcolor: '#f8fafc' }}>COMPREHENSIVE PATIENT RECORD</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fcfcfc' }}>
          {loadingFull ? (
            <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
          ) : (
            fullHistoryItems.map((item, idx) => (
              <Box key={idx} sx={{ mb: 5 }}>
                <Typography variant="h6" fontWeight="900" color="primary" gutterBottom>
                  Visit Date: {item.encounter.created_at?.toDate().toLocaleDateString()}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" fontWeight="900">VITALS & RISK</Typography>
                    <Box sx={{ mt: 1, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Typography variant="body2">BP: {item.vitals?.systolic}/{item.vitals?.diastolic}</Typography>
                      <Typography variant="body2">BMI: {item.vitals?.bmi}</Typography>
                      <Typography variant="body2">Temp: {item.vitals?.temperature}°C</Typography>
                      {renderRiskChips(item.vitals)}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle2" fontWeight="900">CLINICAL FINDINGS</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}><strong>Diagnosis:</strong> {item.diagnosis?.diagnosis}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>{item.diagnosis?.notes}</Typography>
                    
                    <Typography variant="subtitle2" fontWeight="900" sx={{ mt: 2 }}>PRESCRIPTIONS</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {item.prescription?.prescriptions.map((p, pIdx) => (
                        <Typography key={pIdx} variant="body2" sx={{ p: 1, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                          • {p.medicationName} ({p.dosageValue}{p.dosageUnit}) - {p.frequencyValue} {p.frequencyUnit}
                        </Typography>
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
                {idx < fullHistoryItems.length - 1 && <Divider sx={{ mt: 4, mb: 2, borderWidth: 1, borderStyle: 'dashed' }} />}
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setOpenFullHistory(false)} variant="contained" sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}>Close History</Button>
        </DialogActions>
      </Dialog>

      {printItem && patient && (
        <Box sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <PrescriptionPrintView 
            patient={patient} encounter={printItem.encounter} vitals={printItem.vitals}
            diagnosis={printItem.diagnosis} prescription={printItem.prescription} triage={printItem.triage}
            countryCode={selectedCountry?.id || 'BD'} clinicName={selectedClinic?.name}
          />
        </Box>
      )}
    </Box>
  );
};

export default PatientHistoryTimeline;