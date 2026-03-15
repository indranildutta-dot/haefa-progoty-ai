import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  TextField, 
  Button, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  MenuItem,
  Card,
  CardContent,
  Divider,
  Container,
  Modal,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PatientPhotoCapture from '../components/PatientPhotoCapture';
import QrScannerModal from '../components/QrScannerModal';
import { searchPatients, updatePatient } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { createEncounter } from '../services/encounterService';
import { addToQueue } from '../services/queueService';
import { Patient } from '../types';
import { getPatientSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

import { getCountryConfig } from '../config/useCountry';

interface RegistrationStationProps {
  countryId: string;
}

import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const RegistrationStation: React.FC<RegistrationStationProps> = ({ countryId }) => {
  const countryConfig = getCountryConfig(countryId);
  const { notify, selectedClinic, selectedCountry } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchParams, setSearchParams] = useState({ 
    given_name: '', 
    family_name: '', 
    phone: '',
    national_id: '',
    rohingya_number: '',
    bhutanese_refugee_number: '',
    patient_type: '',
    nepal_id: ''
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [badgeData, setBadgeData] = useState<{ patientId: string; name: string; qrCode: string; photoUrl?: string } | null>(null);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | undefined>(undefined);
  const [currentPatientId, setCurrentPatientId] = useState<string>(doc(collection(db, 'patients')).id);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const initialPatientState = {
    given_name: '',
    family_name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '',
    age_years: '' as string | number,
    age_months: '' as string | number,
    age_days: '' as string | number,
    phone: '',
    marital_status: '' as any,
    patient_type: '',
    national_id: '',
    rohingya_number: '',
    bhutanese_refugee_number: '',
    nepal_id: '',
    address_type: '' as any,
    address_line: '',
    village: '',
    thana: '',
    post_code: '',
    district: '',
    country: ''
  };

  const [newPatient, setNewPatient] = useState(initialPatientState);

  const [validationErrors, setValidationErrors] = useState({
    national_id: '',
    rohingya_number: '',
    nepal_id: ''
  });

  const validateNID = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return ''; // Optional
    const regex = /^(\d{10}|\d{13}|\d{17})$/;
    if (!regex.test(trimmed)) {
      return "Invalid NID. Must be 10, 13, or 17 digits.";
    }
    return '';
  };

  const validateRohingyaNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return ''; // Optional
    const patternA = /^(?=.*-)[a-zA-Z0-9-]{8,15}$/;
    const patternB = /^1\d{16}$/;
    if (!patternA.test(trimmed) && !patternB.test(trimmed)) {
      return "Not a valid Rohingya Refugee number. Format must be alphanumeric with a dash or a 17-digit MoHA number.";
    }
    return '';
  };

  const validateNepalID = (value: string, patientType: string) => {
    const trimmed = value.trim();
    if (!trimmed) return ''; // Optional
    
    if (patientType === 'Nepali Citizen') {
      if (!/^\d{10}$/.test(trimmed)) {
        return "Invalid Nepal Rastriya Parichaya Patra. Must be exactly 10 digits.";
      }
    } else if (patientType === 'Bhutanese Refugee') {
      const isRC = /^\d{5,8}$/.test(trimmed);
      const isUNHCR = /^\d{10,12}$/.test(trimmed);
      if (!isRC && !isUNHCR) {
        return "Invalid Bhutanese Refugee ID. Must be 5-8 digits (RC) or 10-12 digits (UNHCR).";
      }
    }
    return '';
  };

  const handleSearch = async () => {
    if (!searchParams.given_name && !searchParams.family_name && !searchParams.phone && !searchParams.national_id && !searchParams.rohingya_number && !searchParams.bhutanese_refugee_number && !searchParams.nepal_id) {
      notify("Please enter at least one search criteria.", "warning");
      return;
    }
    setSearching(true);
    try {
      const trimmedParams = {
        ...searchParams,
        national_id: searchParams.national_id.trim(),
        rohingya_number: searchParams.rohingya_number.trim(),
        given_name: searchParams.given_name.trim(),
        family_name: searchParams.family_name.trim(),
        phone: searchParams.phone.trim(),
        bhutanese_refugee_number: searchParams.bhutanese_refugee_number.trim(),
        nepal_id: searchParams.nepal_id?.trim() || ''
      };

      const results = await searchPatients(trimmedParams);
      setSearchResults(results);
      setSearchPerformed(true);
    } catch (error: any) {
      console.error("Error in handleSearch:", error);
      notify(`Error searching patients: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setSearching(false);
    }
  };

  const startEncounter = async (patientId: string, patientName: string) => {
    if (!selectedClinic) return;
    setLoading(true);
    try {
      const encounterId = await createEncounter(patientId);
      await addToQueue({
        patient_id: patientId,
        patient_name: patientName,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals'
      });
      notify(`Encounter started for ${patientName}`, "success");
    } catch (error) {
      notify("Error starting encounter.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatientId(patient.id!);
    setCurrentPatientId(patient.id!);
    setPatientPhotoUrl(patient.photo_url);
    setNewPatient({
      given_name: patient.given_name || '',
      family_name: patient.family_name || '',
      gender: patient.gender || 'male',
      date_of_birth: patient.date_of_birth || '',
      age_years: patient.age_years || '',
      age_months: patient.age_months || '',
      age_days: patient.age_days || '',
      phone: patient.phone || '',
      marital_status: patient.marital_status || '',
      patient_type: patient.patient_type || '',
      national_id: patient.national_id || '',
      rohingya_number: patient.rohingya_number || '',
      bhutanese_refugee_number: patient.bhutanese_refugee_number || '',
      nepal_id: patient.patient_type === 'Bhutanese Refugee' ? (patient.bhutanese_refugee_number || '') : (patient.national_id || ''),
      address_type: patient.address_type || '',
      address_line: patient.address_line || '',
      village: patient.village || '',
      thana: patient.thana || '',
      post_code: patient.post_code || '',
      district: patient.district || '',
      country: patient.country || ''
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegisterOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic || !selectedCountry) return;

    // Validation for country-specific fields
    const nidError = validateNID(newPatient.national_id);
    const rohingyaError = validateRohingyaNumber(newPatient.rohingya_number);
    const nepalIdError = validateNepalID(newPatient.nepal_id, newPatient.patient_type);
    
    if (nidError || rohingyaError || nepalIdError) {
      setValidationErrors({ national_id: nidError, rohingya_number: rohingyaError, nepal_id: nepalIdError });
      notify("Please fix the validation errors before submitting.", "error");
      return;
    }

    setLoading(true);
    try {
      console.log("Preparing patient data for save...");
      
      // Standardize numeric fields (avoid undefined)
      const age_years = newPatient.age_years !== '' ? Number(newPatient.age_years) : null;
      const age_months = newPatient.age_months !== '' ? Number(newPatient.age_months) : null;
      const age_days = newPatient.age_days !== '' ? Number(newPatient.age_days) : null;

      const patientData: any = {
        ...newPatient,
        national_id: selectedCountry.id === 'NP' ? (newPatient.patient_type === 'Nepali Citizen' ? newPatient.nepal_id.trim() : '') : newPatient.national_id.trim(),
        rohingya_number: newPatient.rohingya_number.trim(),
        bhutanese_refugee_number: selectedCountry.id === 'NP' ? (newPatient.patient_type === 'Bhutanese Refugee' ? newPatient.nepal_id.trim() : '') : newPatient.bhutanese_refugee_number.trim(),
        // Standardize names (save both versions for compatibility)
        first_name: newPatient.given_name,
        last_name: newPatient.family_name,
        // Standardize location (save both versions for compatibility)
        country_id: selectedCountry.id,
        country_code: selectedCountry.id,
        clinic_id: selectedClinic.id,
        // Numeric fields
        age_years,
        age_months,
        age_days,
        photo_url: patientPhotoUrl || null,
        updated_at: serverTimestamp()
      };

      console.log("Patient data to save:", patientData);

      if (!editingPatientId) {
        patientData.created_at = serverTimestamp();
        console.log(`Creating new patient with ID: ${currentPatientId}`);
        try {
          await setDoc(doc(db, 'patients', currentPatientId), patientData);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `patients/${currentPatientId}`);
        }
        
        const qrToken = `HAEFA-${currentPatientId.slice(0, 8)}`;
        console.log(`Generating QR token: ${qrToken}`);
        let qrCodeDataUrl = '';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qrToken);
        } catch (e) {
          console.error("QR Code generation failed:", e);
        }
        
        try {
          await setDoc(doc(db, 'qr_tokens', qrToken), {
            patient_id: currentPatientId,
            created_at: serverTimestamp()
          });
        } catch (e) {
          // Non-critical if QR token fails to save, but let's log it
          console.error("Failed to save QR token:", e);
        }

        setBadgeData({
          patientId: currentPatientId,
          name: `${newPatient.given_name} ${newPatient.family_name}`,
          qrCode: qrCodeDataUrl,
          photoUrl: patientPhotoUrl
        });
        setShowBadgeModal(true);
      } else {
        console.log(`Updating existing patient with ID: ${editingPatientId}`);
        await updatePatient(editingPatientId, patientData);
      }

      console.log("Creating encounter...");
      const encounterId = await createEncounter(currentPatientId);
      console.log(`Encounter created: ${encounterId}`);
      
      console.log("Adding to queue...");
      await addToQueue({
        patient_id: currentPatientId,
        patient_name: `${newPatient.given_name} ${newPatient.family_name}`,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals'
      });
      console.log("Added to queue successfully.");
      
      setSuccessMsg(editingPatientId ? "Patient updated and encounter started!" : "Patient registered and encounter started!");
      
      // Reset form
      setNewPatient(initialPatientState);
      setPatientPhotoUrl(undefined);
      setEditingPatientId(null);
      setCurrentPatientId(doc(collection(db, 'patients')).id);
    } catch (error: any) {
      console.error("Error in handleRegisterOrUpdate:", error);
      notify(`Error processing patient: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <StationLayout
      title="Registration Station"
      stationName="Registration"
      showPatientContext={false}
    >
      <Box sx={{ mb: isMobile ? 2 : 4 }}>
        <Typography variant="subtitle1" color="text.secondary">
          Search for existing patients or register a new patient
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={isMobile ? 2 : 3}>
        {/* Left Column: Search and Results */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom display="flex" alignItems="center">
                <SearchIcon sx={{ mr: 1, color: 'success.main' }} /> Search Existing Patient
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <QrScannerModal onScan={async (token) => {
                  setLoading(true);
                  const patient = await getPatientByQrToken(token);
                  if (patient) {
                    setSearchResults([patient]);
                    setSearchPerformed(true);
                  } else {
                    notify("Patient not found.", "error");
                  }
                  setLoading(false);
                }} />
              </Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Given Name" value={searchParams.given_name} onChange={(e) => setSearchParams({ ...searchParams, given_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Family Name" value={searchParams.family_name} onChange={(e) => setSearchParams({ ...searchParams, family_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Phone" value={searchParams.phone} onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })} />
                </Grid>
                {selectedCountry?.id === 'BD' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Bangladesh National ID Number" value={searchParams.national_id} onChange={(e) => setSearchParams({ ...searchParams, national_id: e.target.value })} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Rohingya Refugee Number" value={searchParams.rohingya_number} onChange={(e) => setSearchParams({ ...searchParams, rohingya_number: e.target.value })} />
                    </Grid>
                  </>
                )}
                {selectedCountry?.id === 'NP' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Patient Type</InputLabel>
                        <Select
                          value={searchParams.patient_type || ''}
                          label="Patient Type"
                          onChange={(e) => setSearchParams({ ...searchParams, patient_type: e.target.value })}
                        >
                          <MenuItem value="Nepali Citizen">Nepali Citizen</MenuItem>
                          <MenuItem value="Bhutanese Refugee">Bhutanese Refugee</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label={searchParams.patient_type === 'Bhutanese Refugee' ? "Bhutanese Refugee ID" : "Rastriya Parichaya Patra"} 
                        value={searchParams.nepal_id || ''} 
                        onChange={(e) => setSearchParams({ ...searchParams, nepal_id: e.target.value })} 
                      />
                    </Grid>
                  </>
                )}
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" color="success" fullWidth onClick={handleSearch} disabled={searching} sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}>
                    {searching ? <CircularProgress size={24} /> : "Search Patient"}
                  </Button>
                </Grid>
              </Grid>

              {searchPerformed && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Search Results ({searchResults.length})
                  </Typography>
                  {searchResults.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {isMobile || isTablet ? (
                        searchResults.map((patient) => (
                          <Card key={patient.id} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="subtitle1" fontWeight="bold">{patient.given_name} {patient.family_name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                  {patient.gender} • {patient.phone || 'No Phone'}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton color="primary" onClick={() => handleEditPatient(patient)}>
                                  <EditIcon />
                                </IconButton>
                                <IconButton color="success" onClick={() => startEncounter(patient.id!, `${patient.given_name} ${patient.family_name}`)} disabled={loading}>
                                  <PlayArrowIcon />
                                </IconButton>
                              </Box>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Gender</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {searchResults.map((patient) => (
                                <TableRow key={patient.id} hover>
                                  <TableCell>{patient.given_name} {patient.family_name}</TableCell>
                                  <TableCell sx={{ textTransform: 'capitalize' }}>{patient.gender}</TableCell>
                                  <TableCell>{patient.phone}</TableCell>
                                  <TableCell>
                                    {patient.national_id || patient.rohingya_number || patient.bhutanese_refugee_number || '-'}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                      <Tooltip title="Edit Patient">
                                        <IconButton size="small" color="primary" onClick={() => handleEditPatient(patient)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Button variant="contained" color="success" size="small" onClick={() => startEncounter(patient.id!, `${patient.given_name} ${patient.family_name}`)} disabled={loading} sx={{ borderRadius: 2 }}>
                                        Start
                                      </Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>No matching patient found. You may register a new patient.</Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Registration Form */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom display="flex" alignItems="center">
                <PersonAddIcon sx={{ mr: 1, color: 'success.main' }} /> {editingPatientId ? 'Edit Patient' : 'Register New Patient'}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <form onSubmit={handleRegisterOrUpdate}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                      <PatientPhotoCapture 
                        patientId={currentPatientId} 
                        onPhotoUploaded={setPatientPhotoUrl} 
                        currentPhoto={patientPhotoUrl} 
                      />
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Given Name" required value={newPatient.given_name} onChange={(e) => setNewPatient({ ...newPatient, given_name: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Family Name" required value={newPatient.family_name} onChange={(e) => setNewPatient({ ...newPatient, family_name: e.target.value })} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Age (Year / Month / Day)</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 4 }}>
                        <TextField fullWidth label="Year" type="number" value={newPatient.age_years} onChange={(e) => setNewPatient({ ...newPatient, age_years: e.target.value })} />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField fullWidth label="Month" type="number" value={newPatient.age_months} onChange={(e) => setNewPatient({ ...newPatient, age_months: e.target.value })} />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField fullWidth label="Day" type="number" value={newPatient.age_days} onChange={(e) => setNewPatient({ ...newPatient, age_days: e.target.value })} />
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Date of Birth" 
                      type="date"
                      InputLabelProps={{ shrink: true }} 
                      value={newPatient.date_of_birth} 
                      onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth select label="Gender" required value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Contact No." value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth select label="Marital Status" required value={newPatient.marital_status} onChange={(e) => setNewPatient({ ...newPatient, marital_status: e.target.value })}>
                      <MenuItem value="single">Single</MenuItem>
                      <MenuItem value="married">Married</MenuItem>
                      <MenuItem value="divorced">Divorced</MenuItem>
                      <MenuItem value="widowed">Widowed</MenuItem>
                      <MenuItem value="separated">Separated</MenuItem>
                    </TextField>
                  </Grid>

                  {/* Country Specific ID Fields */}
                  {selectedCountry?.id === 'BD' && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          label="Bangladesh National ID Number" 
                          value={newPatient.national_id} 
                          onChange={(e) => {
                            setNewPatient({ ...newPatient, national_id: e.target.value });
                            setValidationErrors({ ...validationErrors, national_id: validateNID(e.target.value) });
                          }}
                          onBlur={(e) => setValidationErrors({ ...validationErrors, national_id: validateNID(e.target.value) })}
                          error={!!validationErrors.national_id}
                          helperText={validationErrors.national_id}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          label="Rohingya Refugee Number" 
                          value={newPatient.rohingya_number} 
                          onChange={(e) => {
                            setNewPatient({ ...newPatient, rohingya_number: e.target.value });
                            setValidationErrors({ ...validationErrors, rohingya_number: validateRohingyaNumber(e.target.value) });
                          }}
                          onBlur={(e) => setValidationErrors({ ...validationErrors, rohingya_number: validateRohingyaNumber(e.target.value) })}
                          error={!!validationErrors.rohingya_number}
                          helperText={validationErrors.rohingya_number}
                        />
                      </Grid>
                    </>
                  )}

                  {selectedCountry?.id === 'NP' && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          select 
                          label="Patient Type" 
                          required 
                          value={newPatient.patient_type} 
                          onChange={(e) => {
                            const newType = e.target.value;
                            setNewPatient({ ...newPatient, patient_type: newType });
                            setValidationErrors({ ...validationErrors, nepal_id: validateNepalID(newPatient.nepal_id, newType) });
                          }}
                        >
                          <MenuItem value="Nepali Citizen">Nepali Citizen</MenuItem>
                          <MenuItem value="Bhutanese Refugee">Bhutanese Refugee</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          label={newPatient.patient_type === 'Bhutanese Refugee' ? "Bhutanese Refugee ID" : "Rastriya Parichaya Patra"} 
                          value={newPatient.nepal_id} 
                          onChange={(e) => {
                            setNewPatient({ ...newPatient, nepal_id: e.target.value });
                            setValidationErrors({ ...validationErrors, nepal_id: validateNepalID(e.target.value, newPatient.patient_type) });
                          }}
                          onBlur={(e) => setValidationErrors({ ...validationErrors, nepal_id: validateNepalID(e.target.value, newPatient.patient_type) })}
                          error={!!validationErrors.nepal_id}
                          helperText={validationErrors.nepal_id}
                        />
                      </Grid>
                    </>
                  )}

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }}>
                      <Chip label="Address Information" size="small" />
                    </Divider>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth select label="Address Type" value={newPatient.address_type} onChange={(e) => setNewPatient({ ...newPatient, address_type: e.target.value })}>
                      <MenuItem value="home">Home</MenuItem>
                      <MenuItem value="refugee camp">Refugee Camp</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Address Line" value={newPatient.address_line} onChange={(e) => setNewPatient({ ...newPatient, address_line: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Village" value={newPatient.village} onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Thana" value={newPatient.thana} onChange={(e) => setNewPatient({ ...newPatient, thana: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Post Code" value={newPatient.post_code} onChange={(e) => setNewPatient({ ...newPatient, post_code: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="District" value={newPatient.district} onChange={(e) => setNewPatient({ ...newPatient, district: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Country" value={newPatient.country} onChange={(e) => setNewPatient({ ...newPatient, country: e.target.value })} />
                  </Grid>

                  <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained" color="success" fullWidth size="large" disabled={loading || !!validationErrors.national_id || !!validationErrors.rohingya_number || !!validationErrors.nepal_id} sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}>
                      {loading ? <CircularProgress size={24} /> : (editingPatientId ? "Update & Start Encounter" : "Register & Start Encounter")}
                    </Button>
                    {editingPatientId && (
                      <Button fullWidth sx={{ mt: 1 }} color="inherit" onClick={() => {
                        setEditingPatientId(null);
                        setNewPatient(initialPatientState);
                        setPatientPhotoUrl(undefined);
                        setCurrentPatientId(doc(collection(db, 'patients')).id);
                      }}>
                        Cancel Edit
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Badge Modal */}
      <Modal open={showBadgeModal} onClose={() => setShowBadgeModal(false)}>
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          bgcolor: 'background.paper', 
          p: isMobile ? 2 : 4, 
          borderRadius: 4, 
          width: isMobile ? '90%' : 450,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 24
        }}>
          <Typography variant="h5" fontWeight="900" gutterBottom align="center" color="success.main">
            Registration Success
          </Typography>
          
          {badgeData && (
            <Box 
              id="badge-to-print" 
              sx={{ 
                p: isMobile ? 2 : 3, 
                border: '2px solid',
                borderColor: 'divider',
                borderRadius: 3, 
                mt: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                bgcolor: '#fff'
              }}
            >
              <Typography 
                variant="h4" 
                fontWeight="900" 
                sx={{ 
                  mb: 3, 
                  lineHeight: 1.1,
                  color: 'primary.main',
                  textTransform: 'uppercase',
                  fontSize: isMobile ? '1.25rem' : '1.75rem'
                }}
              >
                Health and Education for all
              </Typography>

              {badgeData.photoUrl ? (
                <Avatar 
                  src={badgeData.photoUrl} 
                  sx={{ 
                    width: isMobile ? 100 : 150, 
                    height: isMobile ? 100 : 150, 
                    mb: 2,
                    border: '4px solid',
                    borderColor: 'primary.light',
                    boxShadow: 2
                  }} 
                />
              ) : (
                <Avatar sx={{ width: isMobile ? 100 : 150, height: isMobile ? 100 : 150, mb: 2, bgcolor: 'grey.200', color: 'text.secondary' }}>
                  No Photo
                </Avatar>
              )}

              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, color: 'text.primary', fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
                {badgeData.name}
              </Typography>

              {badgeData.qrCode && (
                <Box sx={{ p: 1, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <img 
                    src={badgeData.qrCode} 
                    alt="QR Code" 
                    style={{ width: isMobile ? 100 : 140, height: isMobile ? 100 : 140, display: 'block' }} 
                  />
                </Box>
              )}
              
              <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary', fontWeight: 500 }}>
                Patient ID: {badgeData.patientId.slice(0, 8)}...
              </Typography>
            </Box>
          )}

          <Button 
            variant="contained" 
            color="success" 
            fullWidth 
            size="large"
            sx={{ mt: 3, py: 1.5, borderRadius: 2, fontWeight: 'bold' }} 
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head>
                      <title>Patient Card - ${badgeData?.name}</title>
                      <style>
                        body { font-family: sans-serif; display: flex; justify-content: center; padding: 20px; }
                        #badge { width: 350px; border: 2px solid #eee; padding: 30px; border-radius: 20px; text-align: center; }
                        h1 { font-size: 24px; font-weight: 900; margin-bottom: 20px; text-transform: uppercase; color: #1976d2; }
                        img.photo { width: 150px; height: 150px; border-radius: 50%; border: 4px solid #e3f2fd; margin-bottom: 15px; object-fit: cover; }
                        h2 { font-size: 22px; margin-bottom: 15px; }
                        img.qr { width: 140px; height: 140px; }
                      </style>
                    </head>
                    <body>
                      <div id="badge">
                        <h1>Health and Education for all</h1>
                        ${badgeData?.photoUrl ? `<img class="photo" src="${badgeData.photoUrl}">` : ''}
                        <h2>${badgeData?.name}</h2>
                        ${badgeData?.qrCode ? `<img class="qr" src="${badgeData.qrCode}">` : ''}
                      </div>
                      <script>window.onload = () => { window.print(); window.close(); }</script>
                    </body>
                  </html>
                `);
                printWindow.document.close();
              }
            }}
          >
            Print Patient Card
          </Button>
        </Box>
      </Modal>
    </StationLayout>
  );
};

export default RegistrationStation;
