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

import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const RegistrationStation: React.FC<RegistrationStationProps> = ({ countryId }) => {
  const country = getCountryConfig(countryId);
  const { notify, selectedClinic, selectedCountry } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchParams, setSearchParams] = useState({ first_name: '', last_name: '', phone: '' });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [badgeData, setBadgeData] = useState<{ patientId: string; name: string; qrCode: string; photoUrl?: string } | null>(null);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | undefined>(undefined);
  const [currentPatientId, setCurrentPatientId] = useState<string>(doc(collection(db, 'patients')).id);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '',
    phone: '',
    village: ''
  });

  const handleSearch = async () => {
    if (!searchParams.first_name && !searchParams.last_name && !searchParams.phone) {
      notify("Please enter at least one search criteria.", "warning");
      return;
    }
    setSearching(true);
    try {
      const results = await searchPatients(searchParams);
      setSearchResults(results);
      setSearchPerformed(true);
    } catch (error) {
      notify("Error searching patients.", "error");
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = value;
    if (value.length > 4) {
      formatted = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    } else if (value.length > 2) {
      // Just a simple heuristic for YYYY-MM-DD
    }
    
    setNewPatient({ ...newPatient, date_of_birth: e.target.value });
  };

  const handleRegisterAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic || !selectedCountry) return;
    
    setLoading(true);
    try {
      const patientData = {
        ...newPatient,
        country_code: selectedCountry.id,
        photo_url: patientPhotoUrl,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      await setDoc(doc(db, 'patients', currentPatientId), patientData);
      
      const qrToken = `HAEFA-${currentPatientId.slice(0, 8)}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrToken);
      
      await setDoc(doc(db, 'qr_tokens', qrToken), {
        patient_id: currentPatientId,
        created_at: serverTimestamp()
      });

      const encounterId = await createEncounter(currentPatientId);
      await addToQueue({
        patient_id: currentPatientId,
        patient_name: `${newPatient.first_name} ${newPatient.last_name}`,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals'
      });
      
      setBadgeData({
        patientId: currentPatientId,
        name: `${newPatient.first_name} ${newPatient.last_name}`,
        qrCode: qrCodeDataUrl,
        photoUrl: patientPhotoUrl
      });
      
      setShowBadgeModal(true);
      setSuccessMsg("Patient registered and encounter started!");
      
      // Reset form
      setNewPatient({ first_name: '', last_name: '', gender: 'male', date_of_birth: '', phone: '', village: '' });
      setPatientPhotoUrl(undefined);
      setCurrentPatientId(doc(collection(db, 'patients')).id);
    } catch (error) {
      notify("Error registering patient.", "error");
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
        <Grid size={{ xs: 12, lg: 7 }}>
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
                  <TextField fullWidth label="First Name" value={searchParams.first_name} onChange={(e) => setSearchParams({ ...searchParams, first_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Last Name" value={searchParams.last_name} onChange={(e) => setSearchParams({ ...searchParams, last_name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth label="Phone" value={searchParams.phone} onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })} />
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {isMobile || isTablet ? (
                        // Card layout for mobile/tablet
                        searchResults.map((patient) => (
                          <Card key={patient.id} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="subtitle1" fontWeight="bold">{patient.first_name} {patient.last_name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                  {patient.gender} • {patient.phone || 'No Phone'}
                                </Typography>
                              </Box>
                              <Button variant="contained" color="success" onClick={() => startEncounter(patient.id!, `${patient.first_name} ${patient.last_name}`)} disabled={loading}>
                                Start
                              </Button>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        // Table layout for desktop
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
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom display="flex" alignItems="center">
                <PersonAddIcon sx={{ mr: 1, color: 'success.main' }} /> Register New Patient
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 5, md: 4, lg: 12 }}>
                  <Box sx={{ mb: isMobile ? 3 : 0 }}>
                    <PatientPhotoCapture 
                      patientId={currentPatientId} 
                      onPhotoUploaded={setPatientPhotoUrl} 
                      currentPhoto={patientPhotoUrl} 
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 7, md: 8, lg: 12 }}>
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
                          {loading ? <CircularProgress size={24} /> : "Register & Start Encounter"}
                        </Button>
                      </Grid>
                    </Grid>
                  </form>
                </Grid>
              </Grid>
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
    </StationLayout>
  );
};

export default RegistrationStation;
