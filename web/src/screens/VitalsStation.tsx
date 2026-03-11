import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Alert,
  Divider,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Container
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import FavoriteIcon from '@mui/icons-material/Favorite';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { subscribeToQueue, updateQueueStatus, updateQueueTriage } from '../services/queueService';
import { saveVitals } from '../services/encounterService';
import { saveTriageAssessment } from '../services/triageService';
import { QueueItem, Vitals, Patient, TriageLevel } from '../types';
import { getPatientById } from '../services/patientService';
import { auth } from '../firebase';
import { VitalsSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';

interface VitalsStationProps {
  countryId: string;
}

const VitalsStation: React.FC<VitalsStationProps> = ({ countryId }) => {
  const { notify } = useAppStore();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [openVitalsDialog, setOpenVitalsDialog] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Triage State
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [manualTriageLevel, setManualTriageLevel] = useState<TriageLevel | null>(null);
  const [triageAssessment, setTriageAssessment] = useState({
    allergies: '',
    tobaccoUse: 'none' as 'none' | 'former' | 'current',
    alcoholUse: 'none' as 'none' | 'occasional' | 'regular',
    chronicDiseases: [] as string[],
    familyMedicalHistory: '',
    pregnancyStatus: 'no' as 'yes' | 'no' | 'unknown',
    triageNotes: ''
  });

  // Vitals Form State
  const [vitals, setVitals] = useState<Vitals>({
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    temperature: 36.5,
    weight: 70,
    height: 170,
    bmi: 24.2,
    oxygenSaturation: 98
  });

  useEffect(() => {
    const unsubscribe = subscribeToQueue('WAITING_FOR_VITALS' as any, (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, []);

  // Calculate BMI automatically
  useEffect(() => {
    if (vitals.weight && vitals.height) {
      const heightInMeters = vitals.height / 100;
      const bmi = vitals.weight / (heightInMeters * heightInMeters);
      setVitals(prev => ({ ...prev, bmi: parseFloat(bmi.toFixed(1)) }));
    }
  }, [vitals.weight, vitals.height]);

  // Evaluate Triage automatically
  useEffect(() => {
    const result = evaluateTriage(vitals);
    setTriageResult(result);
  }, [vitals]);

  const handleOpenVitals = (item: QueueItem) => {
    setSelectedItem(item);
    setManualTriageLevel(null);
    setVitals({
      systolic: 120,
      diastolic: 80,
      heartRate: 72,
      temperature: 36.5,
      weight: 70,
      height: 170,
      bmi: 24.2,
      oxygenSaturation: 98
    });
    setOpenVitalsDialog(true);
  };

  const handleSaveVitals = async () => {
    if (!selectedItem) return;
    setErrorMsg(null);
    try {
      // 1. Validate with Zod
      const validatedVitals = VitalsSchema.parse(vitals);

      // 2. Save Vitals
      await saveVitals({
        ...validatedVitals,
        encounter_id: selectedItem.encounter_id,
        patient_id: selectedItem.patient_id,
        created_by: auth.currentUser?.uid || 'unknown'
      });

      // 3. Save Triage Assessment
      await saveTriageAssessment({
        encounter_id: selectedItem.encounter_id,
        patient_id: selectedItem.patient_id,
        recorded_by: auth.currentUser?.uid || 'unknown',
        allergies: triageAssessment.allergies.split(',').map(a => a.trim()).filter(a => a !== ''),
        tobacco_use: triageAssessment.tobaccoUse,
        alcohol_use: triageAssessment.alcoholUse,
        chronic_diseases: triageAssessment.chronicDiseases as any,
        family_medical_history: triageAssessment.familyMedicalHistory,
        pregnancy_status: triageAssessment.pregnancyStatus,
        triage_notes: triageAssessment.triageNotes
      });

      // 4. Update Queue Triage
      const finalTriageLevel = manualTriageLevel || triageResult?.triage_level || 'standard';
      const isManual = !!manualTriageLevel && manualTriageLevel !== triageResult?.triage_level;
      
      let finalPriorityScore = triageResult?.priority_score || 50;
      if (isManual) {
        if (finalTriageLevel === 'emergency') finalPriorityScore = 100;
        else if (finalTriageLevel === 'urgent') finalPriorityScore = 75;
        else if (finalTriageLevel === 'standard') finalPriorityScore = 50;
        else if (finalTriageLevel === 'low') finalPriorityScore = 25;
      }

      await updateQueueTriage(selectedItem.id!, {
        triage_level: finalTriageLevel,
        priority_score: finalPriorityScore,
        triage_source: isManual ? 'manual' : 'automatic',
        triage_reason: triageResult?.triage_reason || 'Normal vitals'
      });

      // 4. Update Queue Status
      await updateQueueStatus(selectedItem.id!, 'READY_FOR_DOCTOR' as any);

      notify(`Vitals recorded for ${selectedItem.patient_name}`, 'success');
      setOpenVitalsDialog(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error(err);
      if (err.errors) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg("Failed to save vitals.");
      }
      notify("Failed to save vitals", "error");
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="primary" gutterBottom sx={{ textTransform: 'uppercase' }}>
          Vitals & Triage Station
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Record patient vitals and triage assessment.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <LocalHospitalIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="800">Patients Waiting for Vitals</Typography>
              </Box>
              
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Registration Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="textSecondary" sx={{ py: 4 }}>No patients waiting for vitals.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      waitingList.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                          <TableCell>{item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                              size="small" 
                              color={
                                item.triage_level === 'emergency' ? 'error' :
                                item.triage_level === 'urgent' ? 'warning' :
                                item.triage_level === 'low' ? 'success' : 'default'
                              }
                              sx={{ fontWeight: 700, borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button variant="contained" size="small" onClick={() => handleOpenVitals(item)} sx={{ borderRadius: 2 }}>
                              Take Vitals
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
                Queue Summary
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="body1">Waiting</Typography>
                <Typography variant="h4" fontWeight="800">{waitingList.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vitals Entry Dialog */}
      <Dialog open={openVitalsDialog} onClose={() => setOpenVitalsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: '900', pb: 0, textTransform: 'uppercase' }}>Record Vitals: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {/* Vital Signs */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vital Signs</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Systolic" type="number" value={vitals.systolic} onChange={(e) => setVitals({ ...vitals, systolic: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Diastolic" type="number" value={vitals.diastolic} onChange={(e) => setVitals({ ...vitals, diastolic: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Heart Rate" type="number" value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) })} InputProps={{ startAdornment: <InputAdornment position="start"><FavoriteIcon color="error" fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end">bpm</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Weight" type="number" value={vitals.weight} onChange={(e) => setVitals({ ...vitals, weight: parseFloat(e.target.value) })} InputProps={{ startAdornment: <InputAdornment position="start"><MonitorWeightIcon color="action" fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end">kg</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Height" type="number" value={vitals.height} onChange={(e) => setVitals({ ...vitals, height: parseFloat(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="BMI" type="number" disabled value={vitals.bmi} InputProps={{ endAdornment: <InputAdornment position="end">kg/m²</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Temperature" type="number" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) })} InputProps={{ startAdornment: <InputAdornment position="start"><ThermostatIcon color="warning" fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end">°C</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Oxygen Saturation" type="number" value={vitals.oxygenSaturation} onChange={(e) => setVitals({ ...vitals, oxygenSaturation: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            </Grid>

            {/* Triage & Background */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Safety & Background</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Allergies (comma separated)" value={triageAssessment.allergies} onChange={(e) => setTriageAssessment({...triageAssessment, allergies: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Tobacco Use</InputLabel>
                <Select value={triageAssessment.tobaccoUse} onChange={(e) => setTriageAssessment({...triageAssessment, tobaccoUse: e.target.value as any})}>
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="former">Former</MenuItem>
                  <MenuItem value="current">Current</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Alcohol Use</InputLabel>
                <Select value={triageAssessment.alcoholUse} onChange={(e) => setTriageAssessment({...triageAssessment, alcoholUse: e.target.value as any})}>
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="occasional">Occasional</MenuItem>
                  <MenuItem value="regular">Regular</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Chronic Diseases</InputLabel>
                <Select multiple value={triageAssessment.chronicDiseases} onChange={(e) => setTriageAssessment({...triageAssessment, chronicDiseases: e.target.value as string[]})}>
                  <MenuItem value="diabetes">Diabetes</MenuItem>
                  <MenuItem value="hypertension">Hypertension</MenuItem>
                  <MenuItem value="asthma">Asthma</MenuItem>
                  <MenuItem value="heart disease">Heart Disease</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Family Medical History" value={triageAssessment.familyMedicalHistory} onChange={(e) => setTriageAssessment({...triageAssessment, familyMedicalHistory: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Pregnancy Status</InputLabel>
                <Select value={triageAssessment.pregnancyStatus} onChange={(e) => setTriageAssessment({...triageAssessment, pregnancyStatus: e.target.value as any})}>
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="unknown">Unknown</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Triage Notes" multiline rows={3} value={triageAssessment.triageNotes} onChange={(e) => setTriageAssessment({...triageAssessment, triageNotes: e.target.value})} />
            </Grid>

            {/* Triage Assessment */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Triage Assessment</Typography>
              
              {triageResult?.isCritical && (
                <Alert severity="error" icon={<WarningAmberIcon fontSize="large" />} sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight="bold">CRITICAL VITALS DETECTED</Typography>
                  <Typography variant="body1">Patient requires immediate doctor attention.</Typography>
                </Alert>
              )}

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="textSecondary">Suggested Triage Level:</Typography>
                    <Typography variant="h6" sx={{ 
                      color: triageResult?.triage_level === 'emergency' ? 'error.main' : 
                             triageResult?.triage_level === 'urgent' ? 'warning.main' : 
                             triageResult?.triage_level === 'standard' ? 'success.main' : 'info.main',
                      textTransform: 'uppercase',
                      fontWeight: '800'
                    }}>
                      {triageResult?.triage_level || 'STANDARD'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                      Reason: {triageResult?.triage_reason || 'Normal vitals'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Manual Override (Optional)</InputLabel>
                      <Select value={manualTriageLevel || ''} label="Manual Override (Optional)" onChange={(e) => setManualTriageLevel(e.target.value as TriageLevel)}>
                        <MenuItem value=""><em>Use Suggested</em></MenuItem>
                        <MenuItem value="emergency">Emergency</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                        <MenuItem value="standard">Standard</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenVitalsDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveVitals} size="large" sx={{ fontWeight: 700, borderRadius: 2 }}>
            Save Vitals & Send to Doctor
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VitalsStation;
