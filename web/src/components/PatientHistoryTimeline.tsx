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
  IconButton,
  Grid,
  Tooltip,
  Paper
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import WineBarIcon from '@mui/icons-material/WineBar';
import InfoIcon from '@mui/icons-material/Info';

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
  const [selectedVisitIndex, setSelectedVisitIndex] = useState<number>(0);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!patientId) return;
      setLoading(true);
      try {
        const [encounters, patientData] = await Promise.all([
          getPatientHistory(patientId),
          getPatientById(patientId)
        ]);
        setPatient(patientData);
        
        const completedEncounters = encounters.filter(e => e.encounter_status === 'COMPLETED');
        
        // Only fetch the last 2 visits
        const items = await Promise.all(completedEncounters.slice(0, 2).map(async (encounter) => {
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
        console.error("Critical error fetching patient history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
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
      console.error("Error loading full history:", err);
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
          <Tooltip title={`Pregnancy: ${v.pregnancy_months || '?'} months`}>
            <Chip size="small" icon={<ErrorIcon sx={{ fontSize: '14px' }}/>} label="PREGNANT" sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900 }} />
          </Tooltip>
        )}
        {v.allergies && v.allergies.toLowerCase() !== 'none' && (
          <Tooltip title={`Allergies: ${v.allergies}`}>
            <Chip size="small" icon={<WarningIcon sx={{ fontSize: '14px' }}/>} label="ALLERGIES" sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900 }} />
          </Tooltip>
        )}
        {v.tobacco_use && v.tobacco_use !== 'none' && (
          <Tooltip title={`Tobacco Use: ${v.tobacco_use}`}>
            <Chip 
              size="small" 
              icon={<SmokingRoomsIcon sx={{ fontSize: '14px' }}/>} 
              label={v.tobacco_use === 'chewing' || v.tobacco_use === 'both' ? "GUTKHA/PAN" : "TOBACCO"} 
              sx={{ bgcolor: '#92400e', color: 'white', fontWeight: 900 }} 
            />
          </Tooltip>
        )}
        {v.alcohol_consumption && v.alcohol_consumption !== 'none' && (
          <Chip size="small" icon={<WineBarIcon sx={{ fontSize: '14px' }}/>} label="ALCOHOL" sx={{ bgcolor: '#7c2d12', color: 'white', fontWeight: 900 }} />
        )}
      </Stack>
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>;

  if (historyItems.length === 0) {
    return (
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2, 
          textAlign: 'center', 
          borderRadius: 4, 
          bgcolor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '120px'
        }}
      >
        <HistoryIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
        <Typography 
          variant="caption" 
          fontWeight="800" 
          color="text.disabled"
          sx={{ 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            px: 1,
            lineHeight: 1.2
          }}
        >
          No Previous visit
        </Typography>
      </Paper>
    );
  }

  const currentItem = historyItems[selectedVisitIndex];

  return (
    <Box>
      <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2, display: 'flex', alignItems: 'center' }}>
        <HistoryIcon sx={{ mr: 1, fontSize: 18 }} /> Historical Visits
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button 
          variant={selectedVisitIndex === 0 ? "contained" : "outlined"} 
          size="small"
          fullWidth
          onClick={() => setSelectedVisitIndex(0)}
          sx={{ fontWeight: 900, borderRadius: 2 }}
        >
          Last Visit
        </Button>
        {historyItems.length > 1 && (
          <Button 
            variant={selectedVisitIndex === 1 ? "contained" : "outlined"} 
            size="small"
            fullWidth
            onClick={() => setSelectedVisitIndex(1)}
            sx={{ fontWeight: 900, borderRadius: 2 }}
          >
            2nd Last Visit
          </Button>
        )}
      </Stack>
      
      <Card sx={{ mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="subtitle2" fontWeight="900" color="primary">
              {currentItem.encounter.created_at?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
            <IconButton size="small" onClick={() => handlePrint(currentItem)} sx={{ bgcolor: '#f1f5f9' }}>
              <LocalPrintshopIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
            Diagnosis: {currentItem.diagnosis?.diagnosis || 'General Consultation'}
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Grid container spacing={1}>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">BP</Typography>
              <Typography variant="body2" fontWeight="bold">{currentItem.vitals?.systolic}/{currentItem.vitals?.diastolic}</Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">BMI</Typography>
              <Typography variant="body2" fontWeight="bold">{currentItem.vitals?.bmi || '--'}</Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">HR</Typography>
              <Typography variant="body2" fontWeight="bold">{currentItem.vitals?.heartRate || '--'}</Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">Temp</Typography>
              <Typography variant="body2" fontWeight="bold">{currentItem.vitals?.temperature || '--'}°C</Typography>
            </Grid>
          </Grid>
          
          {renderRiskChips(currentItem.vitals)}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary">Notes:</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.75rem' }}>
              {currentItem.diagnosis?.notes || 'No notes recorded.'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Button variant="outlined" fullWidth onClick={handleViewFullHistory} sx={{ mt: 1, borderRadius: 2, fontWeight: 900, py: 1, borderWidth: 2, borderColor: 'primary.main', fontSize: '0.75rem' }}>
        View Full Medical History
      </Button>

      <Dialog open={openFullHistory} onClose={() => setOpenFullHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          COMPREHENSIVE MEDICAL RECORD
          <IconButton onClick={() => setOpenFullHistory(false)}><InfoIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fcfcfc' }}>
          {loadingFull ? (
            <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
          ) : (
            fullHistoryItems.map((item, idx) => (
              <Box key={idx} sx={{ mb: 6 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="h6" fontWeight="900" color="primary" gutterBottom>
                    Visit: {item.encounter.created_at?.toDate().toLocaleDateString()}
                  </Typography>
                  <Button variant="outlined" startIcon={<LocalPrintshopIcon />} onClick={() => handlePrint(item)}>Print Record</Button>
                </Box>
                
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography variant="subtitle2" fontWeight="900" color="text.secondary">VITAL SIGNS & TRIAGE</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mt: 1, borderRadius: 2 }}>
                      <Typography variant="body2">BP: <strong>{item.vitals?.systolic}/{item.vitals?.diastolic}</strong></Typography>
                      <Typography variant="body2">Heart Rate: <strong>{item.vitals?.heartRate} bpm</strong></Typography>
                      <Typography variant="body2">SpO2: <strong>{item.vitals?.oxygenSaturation}%</strong></Typography>
                      <Typography variant="body2">Temp: <strong>{item.vitals?.temperature}°C</strong></Typography>
                      <Typography variant="body2">BMI: <strong>{item.vitals?.bmi}</strong></Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="caption" display="block">Triage Level: <strong>{item.encounter.triage_level?.toUpperCase() || 'STANDARD'}</strong></Typography>
                      {renderRiskChips(item.vitals)}
                    </Paper>
                  </Grid>
                  
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Typography variant="subtitle2" fontWeight="900" color="text.secondary">CLINICAL ASSESSMENT</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body1" fontWeight="800">{item.diagnosis?.diagnosis}</Typography>
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', color: 'text.secondary', fontStyle: 'italic' }}>
                        {item.diagnosis?.notes || 'No assessment notes provided.'}
                      </Typography>
                    </Box>

                    <Typography variant="subtitle2" fontWeight="900" color="text.secondary" sx={{ mt: 3 }}>PRESCRIPTIONS</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {item.prescription?.prescriptions?.length ? (
                        item.prescription.prescriptions.map((p, pIdx) => (
                          <Paper key={pIdx} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                            <Typography variant="body2" fontWeight="800" color="primary">{p.medicationName}</Typography>
                            <Typography variant="caption">
                              {p.dosageValue}{p.dosageUnit} • {p.frequencyValue} {p.frequencyUnit} • {p.durationValue} {p.durationUnit}
                            </Typography>
                          </Paper>
                        ))
                      ) : (
                        <Typography variant="caption" color="text.disabled">No medications prescribed during this visit.</Typography>
                      )}
                    </Stack>
                  </Grid>
                </Grid>
                {idx < fullHistoryItems.length - 1 && <Divider sx={{ mt: 5, mb: 2, borderWidth: 1 }} />}
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setOpenFullHistory(false)} variant="contained" size="large" sx={{ borderRadius: 2, fontWeight: 900, px: 6 }}>Close Record</Button>
        </DialogActions>
      </Dialog>

      {printItem && patient && (
        <Box sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <PrescriptionPrintView 
            patient={patient}
            encounter={printItem.encounter}
            vitals={printItem.vitals}
            diagnosis={printItem.diagnosis}
            prescription={printItem.prescription}
            triage={printItem.triage}
            countryCode={selectedCountry?.id || 'BD'}
            clinicName={selectedClinic?.name}
          />
        </Box>
      )}
    </Box>
  );
};

export default PatientHistoryTimeline;