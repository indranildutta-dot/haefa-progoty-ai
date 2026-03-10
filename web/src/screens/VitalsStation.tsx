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
  CardContent
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { saveVitals } from '../services/encounterService';
import { QueueItem, Vitals, Patient } from '../types';
import { getPatientById } from '../services/patientService';
import { auth } from '../firebase';
import { VitalsSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';

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

  const handleOpenVitals = (item: QueueItem) => {
    setSelectedItem(item);
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

      // 3. Update Queue Status
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
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Vitals & Triage Station
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <LocalHospitalIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Patients Waiting for Vitals</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient Name</TableCell>
                    <TableCell>Registration Time</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary" sx={{ py: 4 }}>
                          No patients waiting for vitals.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    waitingList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                        <TableCell>
                          {item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            onClick={() => handleOpenVitals(item)}
                          >
                            Take Vitals
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
          <Card sx={{ borderRadius: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Queue Summary
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="body1">Waiting</Typography>
                <Typography variant="h5" fontWeight="bold">{waitingList.length}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="textSecondary">
                Average wait time: 12 mins
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vitals Entry Dialog */}
      <Dialog open={openVitalsDialog} onClose={() => setOpenVitalsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Record Vitals
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Blood Pressure */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom fontWeight="bold">
                Blood Pressure & Heart Rate
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Systolic"
                type="number"
                value={vitals.systolic}
                onChange={(e) => setVitals({ ...vitals, systolic: parseInt(e.target.value) })}
                InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Diastolic"
                type="number"
                value={vitals.diastolic}
                onChange={(e) => setVitals({ ...vitals, diastolic: parseInt(e.target.value) })}
                InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Heart Rate"
                type="number"
                value={vitals.heartRate}
                onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) })}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><FavoriteIcon color="error" fontSize="small" /></InputAdornment>,
                  endAdornment: <InputAdornment position="end">bpm</InputAdornment> 
                }}
              />
            </Grid>

            {/* Anthropometry */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" gutterBottom fontWeight="bold">
                Anthropometry
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Weight"
                type="number"
                value={vitals.weight}
                onChange={(e) => setVitals({ ...vitals, weight: parseFloat(e.target.value) })}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><MonitorWeightIcon color="action" fontSize="small" /></InputAdornment>,
                  endAdornment: <InputAdornment position="end">kg</InputAdornment> 
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Height"
                type="number"
                value={vitals.height}
                onChange={(e) => setVitals({ ...vitals, height: parseFloat(e.target.value) })}
                InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="BMI"
                type="number"
                disabled
                value={vitals.bmi}
                InputProps={{ endAdornment: <InputAdornment position="end">kg/m²</InputAdornment> }}
              />
            </Grid>

            {/* Others */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" gutterBottom fontWeight="bold">
                Temperature & SpO2
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Temperature"
                type="number"
                value={vitals.temperature}
                onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) })}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><ThermostatIcon color="warning" fontSize="small" /></InputAdornment>,
                  endAdornment: <InputAdornment position="end">°C</InputAdornment> 
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Oxygen Saturation"
                type="number"
                value={vitals.oxygenSaturation}
                onChange={(e) => setVitals({ ...vitals, oxygenSaturation: parseInt(e.target.value) })}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenVitalsDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveVitals} size="large">
            Save Vitals & Send to Doctor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VitalsStation;
