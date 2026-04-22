import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Container, Stack, Avatar, Button, Grid, 
  Card, CardContent, Divider, Chip, IconButton, Tooltip, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText,
  InputAdornment, TextField, Autocomplete
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  QrCodeScanner as QrIcon,
  History as HistoryIcon,
  MedicalServices as MedicineIcon,
  Assignment as DiagnosisIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  LocalPharmacy as PharmacyIcon,
  Straighten as VitalsIcon,
  CalendarMonth as CalendarIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { searchPatients, getPatientById } from '../services/patientService';
import { getPatientFullHistory } from '../services/encounterService';
import StationLayout from '../components/StationLayout';
import QrScannerModal from '../components/QrScannerModal';
import { Patient, Encounter, VitalsRecord, DiagnosisRecord, PrescriptionRecord } from '../types';
import dayjs from 'dayjs';

interface HistoryEvent {
  id: string;
  type: 'encounter' | 'dispensation';
  date: Date;
  details: any;
}

const PatientHistory: React.FC = () => {
  const { notify } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Search logic
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const params: any = {};
        if (/^\d+$/.test(searchTerm)) {
          params.national_id = searchTerm;
          params.phone = searchTerm;
        } else {
          params.given_name = searchTerm.split(' ')[0];
          if (searchTerm.split(' ').length > 1) params.family_name = searchTerm.split(' ')[1];
        }
        const results = await searchPatients(params);
        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    setSearchTerm('');
    setSearchResults([]);
    try {
      const data = await getPatientFullHistory(patient.id!);
      setHistory(data);
    } catch (err) {
      notify("Error loading patient history", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleQrScan = async (data: string) => {
    setQrOpen(false);
    if (!data) return;
    setLoadingHistory(true);
    try {
      const patient = await getPatientById(data);
      if (patient) {
        handleSelectPatient(patient);
      } else {
        notify("Patient not found", "error");
        setLoadingHistory(false);
      }
    } catch (err) {
      notify("QR Search failed", "error");
      setLoadingHistory(false);
    }
  };

  const getTriageColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return '#ef4444';
      case 'urgent': return '#f97316';
      case 'standard': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#64748b';
    }
  };

  const renderTimeline = () => {
    if (!history) return null;

    // Combine encounters and "Pharmacy Only" dispensations into a unified timeline
    // A "Pharmacy Only" dispensation is one that happened on a day when there was no encounter creation
    // OR it happened significantly later than the encounter
    const events: HistoryEvent[] = [];

    history.encounters.forEach((enc: Encounter) => {
      events.push({
        id: enc.id!,
        type: 'encounter',
        date: enc.created_at.toDate(),
        details: enc
      });
    });

    // Add dispensations that are essentially separate visits
    history.dispensations.forEach((disp: any) => {
      const dispDate = disp.created_at.toDate();
      const hasCloseEncounter = history.encounters.some((enc: Encounter) => {
        const encDate = enc.created_at.toDate();
        // If within 4 hours of an encounter, consider it part of the encounter flow
        return Math.abs(dispDate.getTime() - encDate.getTime()) < 4 * 60 * 60 * 1000;
      });

      if (!hasCloseEncounter) {
        events.push({
          id: disp.id,
          type: 'dispensation',
          date: dispDate,
          details: disp
        });
      }
    });

    // Sort all events by date DESC
    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
      <Box sx={{ mt: 4 }}>
        <Stack spacing={3}>
          {events.map((event) => {
            if (event.type === 'encounter') {
              const enc = event.details as Encounter;
              const vitals = history.vitals.find((v: VitalsRecord) => v.encounter_id === enc.id);
              const diagnosis = history.diagnoses.find((d: DiagnosisRecord) => d.encounter_id === enc.id);
              const prescription = history.prescriptions.find((p: PrescriptionRecord) => p.encounter_id === enc.id);
              const encDispensations = history.dispensations.filter((d: any) => d.encounter_id === enc.id);

              return (
                <Accordion key={event.id} defaultExpanded sx={{ borderRadius: 3, '&:before': { display: 'none' }, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                      <Box sx={{ 
                        p: 1.5, 
                        bgcolor: '#eff6ff', 
                        color: '#3b82f6', 
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CalendarIcon />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="900" color="primary">
                          {dayjs(event.date).format('MMMM D, YYYY')}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                           <Typography variant="caption" color="text.secondary">
                             Clinic Visit • {dayjs(event.date).format('h:mm A')}
                           </Typography>
                           {enc.triage_level && (
                             <Chip 
                              label={enc.triage_level.toUpperCase()} 
                              size="small" 
                              sx={{ 
                                height: 16, 
                                fontSize: '0.65rem', 
                                fontWeight: 900,
                                bgcolor: getTriageColor(enc.triage_level),
                                color: 'white'
                              }} 
                             />
                           )}
                        </Stack>
                      </Box>
                      <Chip label={enc.status} color={enc.status === 'COMPLETED' ? 'success' : 'warning'} size="small" variant="outlined" />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      {/* Vitals Section */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc', height: '100%' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                            <VitalsIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight="900">Vitals & Body Measures</Typography>
                          </Stack>
                          {vitals ? (
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">BP:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.systolic}/{vitals.diastolic} mmHg</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">HR / RR:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.heartRate} bpm / {vitals.respiratoryRate} rpm</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">Temp:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.temperature}°C</Typography>
                              </Box>
                              <Divider sx={{ my: 1 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">Weight / Height:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.weight}kg / {vitals.height}cm</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">BMI:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.bmi?.toFixed(1)} ({vitals.bmi_class})</Typography>
                              </Box>
                              <Divider sx={{ my: 1 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">Random Glucose:</Typography>
                                <Typography variant="body2" fontWeight="bold">{vitals.rbg || vitals.blood_sugar || '--'} mg/dL</Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">No vitals recorded.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Doctor Section */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f0f9ff', height: '100%', border: '1px solid #bae6fd' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                            <DiagnosisIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight="900">Clinical Assessment</Typography>
                          </Stack>
                          {diagnosis ? (
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block' }}>DIAGNOSIS</Typography>
                                <Typography variant="body2" fontWeight="bold">{diagnosis.diagnosis}</Typography>
                              </Box>
                              {diagnosis.notes && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block' }}>DOCTOR NOTES</Typography>
                                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{diagnosis.notes}</Typography>
                                </Box>
                              )}
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>PRESCRIBER</Typography>
                                <Typography variant="caption" fontWeight="bold">{diagnosis.prescriber_name || 'Staff'}</Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">Consultation in progress or skipped.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Pharmacy Section */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f0fdf4', height: '100%', border: '1px solid #bbf7d0' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                            <PharmacyIcon sx={{ color: '#10b981' }} fontSize="small" />
                            <Typography variant="subtitle2" fontWeight="900" sx={{ color: '#166534' }}>Pharmacy & Dispensing</Typography>
                          </Stack>
                          {prescription ? (
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block' }}>PRESCRIPTIONS</Typography>
                                <List dense sx={{ p: 0 }}>
                                    {prescription.prescriptions.map((p, i) => (
                                      <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                                        <ListItemText 
                                          primary={<Typography variant="caption" fontWeight="bold">{p.medicationName}</Typography>}
                                          secondary={<Typography variant="caption">{p.dosageValue}{p.dosageUnit} x {p.quantity}</Typography>}
                                        />
                                      </ListItem>
                                    ))}
                                </List>
                              </Box>
                              
                              <Divider />
                              
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block' }}>DISPENSING SESSIONS</Typography>
                                {encDispensations.length > 0 ? (
                                  <Stack spacing={1} mt={0.5}>
                                    {encDispensations.map((d: any, idx: number) => (
                                      <Box key={idx} sx={{ p: 0.5, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7' }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block' }}>
                                          {dayjs(d.created_at.toDate()).format('D MMM, HH:mm')} by {d.dispenser_name}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                          {d.items.map((item: any, iidx: number) => (
                                            <Chip 
                                              key={iidx} 
                                              label={`${item.medication}: ${item.dispensed}`} 
                                              size="small" 
                                              sx={{ height: 16, fontSize: '0.6rem', mb: 0.5 }} 
                                              color={item.mode === 'FULL' ? 'success' : 'warning'} 
                                            />
                                          ))}
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Stack>
                                ) : (
                                  <Typography variant="caption">Pending dispensation.</Typography>
                                )}
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">No prescriptions issued.</Typography>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            } else {
              // Dispensation Event (Pharmacy Only)
              const disp = event.details;
              return (
                <Accordion key={event.id} sx={{ borderRadius: 3, '&:before': { display: 'none' }, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4', boxShadow: 'none' }}>
                   <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                      <Box sx={{ 
                        p: 1.5, 
                        bgcolor: '#dcfce7', 
                        color: '#166534', 
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <PharmacyIcon />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="900" color="#166534">
                          {dayjs(event.date).format('MMMM D, YYYY')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Pharmacy Follow-up • {dayjs(event.date).format('h:mm A')}
                        </Typography>
                      </Box>
                      <Chip label="DISPENSED" color="success" size="small" />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'white' }}>
                       <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Follow-up Dispensation Details</Typography>
                       <Typography variant="body2" color="text.secondary" gutterBottom>Dispenser: {disp.dispenser_name} ({disp.dispenser_reg_no})</Typography>
                       <List dense>
                          {disp.items.map((item: any, i: number) => (
                            <ListItem key={i} sx={{ px: 1, py: 0.5, bgcolor: '#f8fafc', mb: 0.5, borderRadius: 1 }}>
                               <ListItemText 
                                  primary={<Typography variant="body2" fontWeight="bold">{item.medication}</Typography>}
                                  secondary={`Dispensed: ${item.dispensed} • Type: ${item.mode}`}
                               />
                            </ListItem>
                          ))}
                       </List>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              );
            }
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <StationLayout title="Patient Clinical History" subtitle="Comprehensive view of all patient encounters and clinical events">
      <Container maxWidth="xl">
        {!selectedPatient ? (
          <Box maxWidth="md" sx={{ mx: 'auto', mt: 8 }}>
            <Paper elevation={0} sx={{ p: 5, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <HistoryIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" fontWeight="900" gutterBottom>Search Patient History</Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                Enter patient name, phone, or ID to view their full clinical timeline.
              </Typography>
              
              <Stack direction="row" spacing={2}>
                 <Autocomplete
                  fullWidth
                  open={searchResults.length > 0}
                  options={searchResults}
                  loading={searching}
                  inputValue={searchTerm}
                  onInputChange={(_, val) => setSearchTerm(val)}
                  onChange={(_, val) => val && handleSelectPatient(val)}
                  getOptionLabel={(o) => `${o.given_name} ${o.family_name} (${o.national_id || 'No ID'})`}
                  renderInput={(params) => (
                    <TextField 
                      {...params}
                      placeholder="Start typing name or ID..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 3, height: 56, bgcolor: '#f8fafc' }
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: 'secondary.light', width: 32, height: 32 }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {option.given_name} {option.family_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.national_id || option.phone || 'No ID'} • {option.gender}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                />
                <Tooltip title="Scan QR Code">
                  <IconButton 
                    color="primary" 
                    onClick={() => setQrOpen(true)}
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white', 
                      '&:hover': { bgcolor: 'primary.dark' },
                      width: 56,
                      height: 56,
                      borderRadius: 3
                    }}
                  >
                    <QrIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          </Box>
        ) : (
          <Box>
            <Button 
              startIcon={<ArrowBackIcon />} 
              onClick={() => setSelectedPatient(null)}
              sx={{ mb: 3 }}
            >
              Back to Search
            </Button>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 5, border: '1px solid #3b82f6', bgcolor: '#f0f9ff', mb: 4 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm="auto">
                  <Avatar 
                    src={selectedPatient.photo_url} 
                    sx={{ width: 100, height: 100, borderRadius: 4, border: '4px solid white', boxShadow: 3 }}
                  >
                    <PersonIcon sx={{ fontSize: 60 }} />
                  </Avatar>
                </Grid>
                <Grid item xs={12} sm>
                  <Typography variant="h4" fontWeight="900" color="primary">
                    {selectedPatient.given_name} {selectedPatient.family_name}
                  </Typography>
                  <Stack direction="row" spacing={2} mt={1}>
                    <Chip icon={<CalendarIcon />} label={`Age: ${selectedPatient.age_years}y ${selectedPatient.age_months}m`} variant="outlined" size="small" />
                    <Chip icon={<InfoIcon />} label={`ID: ${selectedPatient.national_id || selectedPatient.rohingya_number || 'N/A'}`} variant="outlined" size="small" />
                    <Chip label={selectedPatient.gender.toUpperCase()} variant="filled" size="small" color="primary" />
                  </Stack>
                </Grid>
                <Grid item xs={12} md="auto">
                   <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={<DownloadIcon />} color="primary" sx={{ borderRadius: 2 }}>
                        Export History
                      </Button>
                   </Stack>
                </Grid>
              </Grid>
            </Paper>

            {loadingHistory ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress />
              </Box>
            ) : (
              renderTimeline()
            )}
          </Box>
        )}
      </Container>

      <QrScannerModal 
        open={qrOpen} 
        onClose={() => setQrOpen(false)} 
        onScan={handleQrScan} 
      />
    </StationLayout>
  );
};

export default PatientHistory;
