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
  Info as InfoIcon,
  Print as PrintIcon,
  MonitorHeart as HeartIcon,
  Science as LabIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { searchPatients, getPatientById } from '../services/patientService';
import { getPatientFullHistory } from '../services/encounterService';
import StationLayout from '../components/StationLayout';
import { parseFatQrData } from '../utils/qrUtils';
import QrScannerModal from '../components/QrScannerModal';
import PrintPrescriptionDialog from '../components/PrintPrescriptionDialog';
import { Patient, Encounter, VitalsRecord, DiagnosisRecord, PrescriptionRecord } from '../types';
import { calculateAgeDisplay } from '../utils/patient';
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
  
  // Printing State
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintEncounterId, setReprintEncounterId] = useState<string | null>(null);

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

  const handleReprintLatest = () => {
    if (!history?.encounters?.length) {
      notify("No prescriptions found for this patient", "info");
      return;
    }
    
    // Find latest encounter that has a prescription
    const prescEncounters = history.encounters
      .filter((e: Encounter) => history.prescriptions.some((p: PrescriptionRecord) => p.encounter_id === e.id))
      .sort((a: Encounter, b: Encounter) => b.created_at.toMillis() - a.created_at.toMillis());
      
    if (prescEncounters.length > 0) {
      setReprintEncounterId(prescEncounters[0].id);
      setReprintOpen(true);
    } else {
      notify("No prescription records found in history", "info");
    }
  };

  const handleQrScan = async (data: string) => {
    setQrOpen(false);
    if (!data) return;
    setLoadingHistory(true);
    try {
      const hydratedPatient = parseFatQrData(data);
      const searchId = hydratedPatient ? hydratedPatient.id : data;
      
      const patient = await getPatientById(searchId as string);
      if (patient) {
        handleSelectPatient(patient);
      } else if (hydratedPatient && hydratedPatient.given_name) {
        notify("Offline mode: Patient hydrated from QR", "warning");
        handleSelectPatient(hydratedPatient as Patient);
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

    const events: HistoryEvent[] = [];

    history.encounters.forEach((enc: Encounter) => {
      events.push({
        id: enc.id!,
        type: 'encounter',
        date: enc.created_at.toDate(),
        details: enc
      });
    });

    history.dispensations.forEach((disp: any) => {
      const dispDate = disp.created_at.toDate();
      const hasCloseEncounter = history.encounters.some((enc: Encounter) => {
        const encDate = enc.created_at.toDate();
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

    // Sort all events by date ASC (Oldest at top) as requested
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

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
                      <Chip 
                        label={(enc.status === 'COMPLETED' || diagnosis || prescription) ? 'COMPLETED' : `PROGRESS: ${enc.status.replace(/_/g, ' ')}`} 
                        color={(enc.status === 'COMPLETED' || diagnosis || prescription) ? 'success' : 'warning'} 
                        size="small" 
                        variant="outlined" 
                        sx={{ fontWeight: 900 }}
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {/* Body Measures */}
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', height: '100%' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <VitalsIcon color="primary" sx={{ fontSize: 18 }} />
                            <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase' }}>Body Measures</Typography>
                          </Stack>
                          {vitals ? (
                            <Stack spacing={0.5}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">Weight:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.weight || '--'} kg</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">Height:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.height || '--'} cm</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">BMI:</Typography>
                                <Typography variant="caption" fontWeight="bold">
                                  {vitals.bmi?.toFixed(1) || '--'} 
                                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '2px' }}>({vitals.bmi_class || 'N/A'})</span>
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">MUAC:</Typography>
                                <Typography variant="caption" fontWeight="bold">
                                  {vitals.muac || '--'} cm
                                  {vitals.muac_class && <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '2px' }}>({vitals.muac_class})</span>}
                                </Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No data.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Vital Signs */}
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#fff5f5', height: '100%', border: '1px solid #fee2e2' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <HeartIcon sx={{ fontSize: 18, color: '#dc2626' }} />
                            <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: '#991b1b' }}>Vital Signs</Typography>
                          </Stack>
                          {vitals ? (
                            <Stack spacing={0.5}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">BP:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.systolic || '--'}/{vitals.diastolic || '--'} mmHg</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">HR:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.heartRate || '--'} bpm</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">RR:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.respiratoryRate || '--'} rpm</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">Temp:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.temperature || '--'}°C</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">SpO2:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.oxygenSaturation || '--'}%</Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No data.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Labs & Risks */}
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f5f3ff', height: '100%', border: '1px solid #ddd6fe' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <LabIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                            <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: '#5b21b6' }}>Labs & Risks</Typography>
                          </Stack>
                          {vitals ? (
                            <Stack spacing={0.5}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Glucose:</Typography>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block' }}>{vitals.rbg || vitals.blood_sugar || '--'} mg/dL</Typography>
                                  {(vitals.rbg || vitals.blood_sugar) && (
                                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#7c3aed' }}>
                                      {vitals.is_fasting ? '(Fasting)' : '(Random)'}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">Cholesterol:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.total_cholesterol || '--'} mg/dL</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">HDL:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.hdl_cholesterol || '--'} mg/dL</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">Hb:</Typography>
                                <Typography variant="caption" fontWeight="bold">{vitals.hemoglobin || '--'} g/dL</Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No data.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Doctor Section */}
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f0f9ff', height: '100%', border: '1px solid #bae6fd' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <DiagnosisIcon color="primary" sx={{ fontSize: 18 }} />
                            <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: '#0369a1' }}>Doctor Assessment</Typography>
                          </Stack>
                          {diagnosis ? (
                            <Stack spacing={1}>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', fontSize: '0.65rem' }}>DIAGNOSIS</Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ display: 'block' }}>{diagnosis.diagnosis || 'Undiagnosed'}</Typography>
                              </Box>
                              {diagnosis.notes && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', fontSize: '0.65rem' }}>DOCTOR NOTES</Typography>
                                  <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', lineHeight: 1.2 }}>{diagnosis.notes}</Typography>
                                </Box>
                              )}
                              <Typography variant="caption" sx={{ borderTop: '1px solid #e0f2fe', pt: 0.5, fontSize: '0.6rem', color: '#64748b' }}>
                                Prescriber: {diagnosis.prescriber_name || 'Medical Officer'}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Consultation skipped.</Typography>
                          )}
                        </Paper>
                      </Grid>

                      {/* Pharmacy Section */}
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f0fdf4', height: '100%', border: '1px solid #bbf7d0' }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <PharmacyIcon sx={{ color: '#10b981', fontSize: 18 }} />
                            <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: '#166534' }}>Pharmacy & Dispensing</Typography>
                          </Stack>
                          {prescription ? (
                            <Stack spacing={1}>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', fontSize: '0.65rem' }}>PRESCRIPTIONS</Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    {prescription.prescriptions.map((p, i) => (
                                      <Typography key={i} variant="caption" sx={{ display: 'block', fontWeight: 900, lineHeight: 1.1, mb: 0.5 }}>
                                        • {p.medicationName} ({p.quantity})
                                      </Typography>
                                    ))}
                                </Box>
                              </Box>
                              
                              <Box sx={{ borderTop: '1px solid #dcfce7', pt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', fontSize: '0.65rem' }}>DISPENSING</Typography>
                                {encDispensations.length > 0 ? (
                                  <Stack spacing={0.5} mt={0.5}>
                                    {encDispensations.map((d: any, idx: number) => (
                                      <Box key={idx} sx={{ p: 0.5, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7' }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#64748b', display: 'block' }}>
                                          {dayjs(d.created_at.toDate()).format('D MMM, HH:mm')} by {d.dispenser_name}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Stack>
                                ) : (
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Pending...</Typography>
                                )}
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No prescriptions.</Typography>
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
                      <Chip label="DISPENSED" color="success" size="small" sx={{ fontWeight: 900 }} />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'white' }}>
                       <Typography variant="subtitle2" fontWeight="900" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#166534' }}>Follow-up Dispensation Details</Typography>
                       <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>Dispenser: {disp.dispenser_name} ({disp.dispenser_reg_no || 'No Reg No'})</Typography>
                       <List dense>
                          {disp.items.map((item: any, i: number) => (
                            <ListItem key={i} sx={{ px: 1, py: 0.5, bgcolor: '#f8fafc', mb: 0.5, borderRadius: 1 }}>
                               <ListItemText 
                                  primary={<Typography variant="caption" fontWeight="900">{item.medication}</Typography>}
                                  secondary={<Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Dispensed: {item.dispensed} • Mode: {item.mode}</Typography>}
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
    <StationLayout title="Patient Clinical History">
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
              onClick={() => {
                setSelectedPatient(null);
                setHistory(null);
              }}
              sx={{ mb: 3 }}
            >
              Back to Search
            </Button>

            <Paper elevation={0} sx={{ p: 4, borderRadius: 8, border: '1px solid #3b82f6', bgcolor: '#fbfdff', mb: 4, boxShadow: '0 4px 20px -5px rgba(59, 130, 246, 0.1)' }}>
              <Grid container spacing={3} alignItems="center">
                <Grid size={{ xs: 12, sm: 'auto' }}>
                  <Avatar 
                    src={selectedPatient.photo_url} 
                    sx={{ width: 120, height: 120, borderRadius: 6, border: '6px solid white', boxShadow: 3 }}
                  >
                    <PersonIcon sx={{ fontSize: 80 }} />
                  </Avatar>
                </Grid>
                <Grid size={{ xs: 12, sm: 'auto' }}>
                  <Typography variant="h3" fontWeight="900" color="primary" sx={{ letterSpacing: '-0.02em', mb: 1 }}>
                    {selectedPatient.given_name} {selectedPatient.family_name}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Chip 
                      icon={<CalendarIcon sx={{ fontSize: '1rem !important' }} />} 
                      label={calculateAgeDisplay(selectedPatient)} 
                      variant="outlined" 
                      sx={{ fontWeight: 900, height: 28, bgcolor: 'white' }} 
                    />
                    <Chip 
                      icon={<InfoIcon sx={{ fontSize: '1rem !important' }} />} 
                      label={`ID: ${selectedPatient.national_id || selectedPatient.rohingya_number || selectedPatient.bhutanese_refugee_number || selectedPatient.nepal_id || 'N/A'}`} 
                      variant="outlined" 
                      sx={{ fontWeight: 900, height: 28, bgcolor: 'white' }} 
                    />
                    <Chip 
                      label={selectedPatient.gender.toUpperCase()} 
                      variant="filled" 
                      size="small" 
                      color="primary" 
                      sx={{ fontWeight: 900, height: 28, px: 1 }} 
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 'auto' }}>
                   <Stack direction="row" spacing={1}>
                      <Button 
                        variant="contained" 
                        startIcon={<PrintIcon />} 
                        color="secondary" 
                        onClick={handleReprintLatest}
                        sx={{ borderRadius: 2.5, fontWeight: 900, py: 1.5, px: 3 }}
                      >
                        Reprint Latest RX
                      </Button>
                      <Button variant="outlined" startIcon={<DownloadIcon />} color="primary" sx={{ borderRadius: 2.5, fontWeight: 900, py: 1.5, px: 3 }}>
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

      {reprintEncounterId && (
        <PrintPrescriptionDialog
          open={reprintOpen}
          onClose={() => {
            setReprintOpen(false);
            setReprintEncounterId(null);
          }}
          encounterId={reprintEncounterId}
        />
      )}
    </StationLayout>
  );
};

export default PatientHistory;
