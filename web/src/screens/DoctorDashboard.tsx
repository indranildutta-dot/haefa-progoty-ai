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
  Alert,
  Divider,
  Card,
  CardContent,
  Tabs,
  Tab
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MedicationIcon from '@mui/icons-material/Medication';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { getLatestEncounter, updateEncounterConsultation } from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { QueueItem, Encounter, Patient, Prescription } from '../types';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PrescriptionForm from '../components/PrescriptionForm';

interface DoctorDashboardProps {
  countryId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [openConsultDialog, setOpenConsultDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consultation Form State
  const [consultData, setConsultData] = useState({
    chiefComplaint: '',
    diagnosis: '',
    notes: '',
    prescriptions: [] as Prescription[]
  });

  useEffect(() => {
    const unsubscribe = subscribeToQueue('READY_FOR_DOCTOR', countryId, (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, [countryId]);

  const handleOpenConsult = async (item: QueueItem) => {
    setSelectedItem(item);
    try {
      const [patient, encounter] = await Promise.all([
        getPatientById(item.patient_id),
        getLatestEncounter(item.patient_id)
      ]);
      setCurrentPatient(patient);
      setCurrentEncounter(encounter);
      setOpenConsultDialog(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load patient data.");
    }
  };

  const handleSaveConsult = async () => {
    if (!currentEncounter || !selectedItem) return;
    try {
      await updateEncounterConsultation(currentEncounter.id!, consultData);
      await updateQueueStatus(selectedItem.id!, 'WAITING_FOR_PHARMACY' as any);
      
      setSuccessMsg(`Consultation completed. Sent to Pharmacy.`);
      setOpenConsultDialog(false);
      setSelectedItem(null);
      setConsultData({ chiefComplaint: '', diagnosis: '', notes: '', prescriptions: [] });
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save consultation.");
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Doctor Consultation
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <AssignmentIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Patients Ready for Consultation</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient Name</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary" sx={{ py: 4 }}>
                          No patients waiting for consultation.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    waitingList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_id}</TableCell>
                        <TableCell>
                          {item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : '??'} mins
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label="Normal" 
                            size="small" 
                            color="default" 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button 
                            variant="contained" 
                            size="small" 
                            onClick={() => handleOpenConsult(item)}
                          >
                            Start Consultation
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, mb: 3, bgcolor: 'primary.dark', color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Consultations Today</Typography>
              <Typography variant="h3" fontWeight="bold">12</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Consultation Dialog */}
      <Dialog open={openConsultDialog} onClose={() => setOpenConsultDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
          Consultation
          <Typography variant="caption" display="block" color="textSecondary">
            {currentPatient?.gender}, {currentPatient?.date_of_birth}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Grid container sx={{ height: '70vh' }}>
            {/* Left Panel: Vitals & History */}
            <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: '1px solid #eee', overflowY: 'auto', p: 2, bgcolor: '#fafafa' }}>
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="primary">Current Vitals</Typography>
                {currentEncounter?.vitals ? (
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">BP</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentEncounter.vitals.systolic}/{currentEncounter.vitals.diastolic}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">HR</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentEncounter.vitals.heartRate} bpm</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">Temp</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentEncounter.vitals.temperature}°C</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">BMI</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentEncounter.vitals.bmi}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : <Typography variant="caption">No vitals recorded.</Typography>}
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <HistoryIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight="bold">Patient History</Typography>
                </Box>
                {currentPatient && <PatientHistoryTimeline patientId={currentPatient.id!} />}
              </Box>
            </Grid>

            {/* Right Panel: Consultation Form */}
            <Grid size={{ xs: 12, md: 8 }} sx={{ overflowY: 'auto', p: 3 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
                <Tab label="Assessment" icon={<AssignmentIcon />} iconPosition="start" />
                <Tab label="Prescription" icon={<MedicationIcon />} iconPosition="start" />
              </Tabs>

              {tabValue === 0 && (
                <Box>
                  <TextField
                    fullWidth
                    label="Chief Complaint"
                    multiline
                    rows={2}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    value={consultData.chiefComplaint}
                    onChange={(e) => setConsultData({ ...consultData, chiefComplaint: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Diagnosis"
                    variant="outlined"
                    sx={{ mb: 3 }}
                    value={consultData.diagnosis}
                    onChange={(e) => setConsultData({ ...consultData, diagnosis: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Clinical Notes"
                    multiline
                    rows={6}
                    variant="outlined"
                    value={consultData.notes}
                    onChange={(e) => setConsultData({ ...consultData, notes: e.target.value })}
                  />
                </Box>
              )}

              {tabValue === 1 && (
                <PrescriptionForm 
                  prescriptions={consultData.prescriptions} 
                  onChange={(p) => setConsultData({ ...consultData, prescriptions: p })} 
                />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8f9fa' }}>
          <Button onClick={() => setOpenConsultDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveConsult} 
            size="large"
            disabled={!consultData.diagnosis}
          >
            Complete Consultation & Send to Pharmacy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorDashboard;
