import React, { useState } from 'react';
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
  Avatar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PatientPhotoCapture from '../components/PatientPhotoCapture';
import QrScannerModal from '../components/QrScannerModal';
import { searchPatients } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { createEncounter } from '../services/encounterService';
import { addToQueue } from '../services/queueService';
import { Patient } from '../types';
import { getPatientSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';

import { getCountryConfig } from '../config/useCountry';

interface RegistrationStationProps {
  countryId: string;
}

const RegistrationStation: React.FC<RegistrationStationProps> = ({ countryId }) => {
  const country = getCountryConfig(countryId);
  const { notify, selectedClinic, selectedCountry } = useAppStore();
  
  // Search State
  const [searchParams, setSearchParams] = useState({
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Registration Form State
  const [currentPatientId, setCurrentPatientId] = useState<string>(crypto.randomUUID());
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '',
    phone: '',
    village: ''
  });
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string>("");
  const [badgeData, setBadgeData] = useState<{ patientId: string, name: string, photoUrl: string, qrCode: string } | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchParams.first_name && !searchParams.last_name && !searchParams.phone) {
      setErrorMsg("Please enter at least one search field.");
      return;
    }
    setSearching(true);
    setErrorMsg(null);
    setSearchPerformed(true);
    try {
      const results = await searchPatients(searchParams);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error searching for patient.");
    } finally {
      setSearching(false);
    }
  };

  const startEncounter = async (patientId: string, patientName: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Create Encounter
      const encounterId = await createEncounter(patientId);

      // 2. Add to Queue
      await addToQueue({
        encounter_id: encounterId,
        patient_id: patientId,
        patient_name: patientName,
        station: 'vitals',
        status: 'WAITING_FOR_VITALS'
      });

      notify(`Encounter started for ${patientName}`, 'success');
      setSearchResults([]);
      setSearchParams({ first_name: '', last_name: '', phone: '' });
      setSearchPerformed(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to start encounter.");
      notify("Failed to start encounter", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (country?.dateFormat === 'DD/MM/YYYY') {
      if (value.length > 8) value = value.slice(0, 8);
      if (value.length > 4) value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
      else if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
    } else {
      if (value.length > 8) value = value.slice(0, 8);
      if (value.length > 6) value = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
      else if (value.length > 4) value = `${value.slice(0, 4)}-${value.slice(4)}`;
    }
    setNewPatient({ ...newPatient, date_of_birth: value });
  };

  const handleRegisterAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic || !selectedCountry) {
      notify("Clinic or Country not selected.", "error");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Validate with Zod
      const PatientSchema = getPatientSchema(countryId);
      const validatedPatient = PatientSchema.parse(newPatient);

      const patientId = currentPatientId;
      const encounterId = crypto.randomUUID();

      // 2. Create Patient Document
      await setDoc(doc(db, "patients", patientId), {
        ...validatedPatient,
        photoUrl: patientPhotoUrl,
        country_id: selectedCountry.id,
        clinic_id: selectedClinic.id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 3. Create Encounter Document
      await setDoc(doc(db, "encounters", encounterId), {
        patient_id: patientId,
        clinic_id: selectedClinic.id,
        country_code: selectedCountry.id,
        status: 'WAITING_FOR_VITALS',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 5. Add to Queue
      await addDoc(collection(db, "queues_active"), {
        encounter_id: encounterId,
        patient_id: patientId,
        patient_name: `${validatedPatient.first_name} ${validatedPatient.last_name}`,
        station: 'vitals',
        status: 'WAITING_FOR_VITALS',
        clinic_id: selectedClinic.id,
        country_code: selectedCountry.id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 6. Generate Badge Token
      const badgeToken = crypto.randomUUID();
      await setDoc(doc(db, "badge_tokens", badgeToken), {
        patient_id: patientId,
        created_at: serverTimestamp()
      });

      // 7. Generate QR Code
      const qrCode = await QRCode.toDataURL(badgeToken);
      setBadgeData({ patientId, name: `${validatedPatient.first_name} ${validatedPatient.last_name}`, photoUrl: patientPhotoUrl, qrCode });
      setShowBadgeModal(true);

      notify(`Patient ${validatedPatient.first_name} registered successfully`, 'success');
      setNewPatient({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        phone: '',
        village: ''
      });
      setPatientPhotoUrl("");
      setCurrentPatientId(crypto.randomUUID());
      setSearchResults([]);
      setSearchPerformed(false);
    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(`Failed to register patient: ${err.message || "Unknown error"}`);
      notify("Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="success.main" gutterBottom sx={{ textTransform: 'uppercase' }}>
          Registration Station
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Search for existing patients or register a new patient
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        {/* Left Column: Search and Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
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
                  <TextField fullWidth label="First Name" size="small" value={searchParams.first_name} onChange={(e) => setSearchParams({ ...searchParams, first_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Last Name" size="small" value={searchParams.last_name} onChange={(e) => setSearchParams({ ...searchParams, last_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Phone" size="small" value={searchParams.phone} onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })} />
                </Grid>
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
                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Gender</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {searchResults.map((patient) => (
                            <TableRow key={patient.id} hover>
                              <TableCell>{patient.first_name} {patient.last_name}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{patient.gender}</TableCell>
                              <TableCell>{patient.phone}</TableCell>
                              <TableCell align="right">
                                <Button variant="contained" color="success" size="small" onClick={() => startEncounter(patient.id!, `${patient.first_name} ${patient.last_name}`)} disabled={loading} sx={{ borderRadius: 2 }}>
                                  Start
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>No matching patient found. You may register a new patient.</Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Registration Form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom display="flex" alignItems="center">
                <PersonAddIcon sx={{ mr: 1, color: 'success.main' }} /> Register New Patient
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 3 }}>
                <PatientPhotoCapture 
                  patientId={currentPatientId} 
                  onPhotoUploaded={setPatientPhotoUrl} 
                  currentPhoto={patientPhotoUrl} 
                />
              </Box>
              <form onSubmit={handleRegisterAndStart}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="First Name" required value={newPatient.first_name} onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Last Name" required value={newPatient.last_name} onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth select label="Gender" required value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Date of Birth" 
                      required 
                      InputLabelProps={{ shrink: true }} 
                      helperText={country ? `Format: ${country.dateFormat}` : ''} 
                      value={newPatient.date_of_birth} 
                      onChange={handleDateChange}
                      placeholder={country?.dateFormat}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Phone Number" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Village" value={newPatient.village} onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained" color="success" fullWidth size="large" disabled={loading} sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}>
                      {loading ? <CircularProgress size={24} /> : "Register"}
                    </Button>
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
          p: 4, 
          borderRadius: 4, 
          width: 450,
          boxShadow: 24
        }}>
          <Typography variant="h5" fontWeight="900" gutterBottom align="center" color="success.main">
            Registration Success
          </Typography>
          
          {badgeData && (
            <Box 
              id="badge-to-print" 
              sx={{ 
                p: 3, 
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
                  fontSize: '1.75rem'
                }}
              >
                Health and Education for all
              </Typography>

              {badgeData.photoUrl ? (
                <Avatar 
                  src={badgeData.photoUrl} 
                  sx={{ 
                    width: 150, 
                    height: 150, 
                    mb: 2,
                    border: '4px solid',
                    borderColor: 'primary.light',
                    boxShadow: 2
                  }} 
                />
              ) : (
                <Avatar sx={{ width: 150, height: 150, mb: 2, bgcolor: 'grey.200', color: 'text.secondary' }}>
                  No Photo
                </Avatar>
              )}

              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, color: 'text.primary' }}>
                {badgeData.name}
              </Typography>

              {badgeData.qrCode && (
                <Box sx={{ p: 1, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <img 
                    src={badgeData.qrCode} 
                    alt="QR Code" 
                    style={{ width: 140, height: 140, display: 'block' }} 
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
              const printContent = document.getElementById('badge-to-print')?.innerHTML;
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
    </Container>
  );
};

export default RegistrationStation;
