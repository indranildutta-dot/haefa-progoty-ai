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
  Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { createPatient, searchPatients } from '../services/patientService';
import { createEncounter } from '../services/encounterService';
import { addToQueue } from '../services/queueService';
import { Patient } from '../types';
import { PatientSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';

import { getCountryConfig } from '../config/useCountry';

interface RegistrationStationProps {
  countryId: string;
}

const RegistrationStation: React.FC<RegistrationStationProps> = ({ countryId }) => {
  const country = getCountryConfig(countryId);
  const { notify } = useAppStore();
  
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
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '',
    phone: '',
    village: ''
  });

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

  const handleRegisterAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Validate with Zod
      const validatedPatient = PatientSchema.parse(newPatient);

      // 2. Create Patient
      const patientId = await createPatient({
        ...validatedPatient,
        country_id: countryId // Keeping for legacy
      });

      // 3. Create Encounter
      const encounterId = await createEncounter(patientId);

      // 4. Add to Queue
      await addToQueue({
        encounter_id: encounterId,
        patient_id: patientId,
        patient_name: `${validatedPatient.first_name} ${validatedPatient.last_name}`,
        station: 'vitals',
        status: 'WAITING_FOR_VITALS'
      });

      notify(`Patient ${validatedPatient.first_name} registered successfully`, 'success');
      setNewPatient({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        phone: '',
        village: ''
      });
      setSearchResults([]);
      setSearchPerformed(false);
    } catch (err: any) {
      console.error(err);
      if (err.errors) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg("Failed to register patient.");
      }
      notify("Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Registration Station
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={4}>
        {/* Left Column: Search and Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <SearchIcon sx={{ mr: 1 }} /> Search Existing Patient
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  size="small"
                  value={searchParams.first_name}
                  onChange={(e) => setSearchParams({ ...searchParams, first_name: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Last Name"
                  size="small"
                  value={searchParams.last_name}
                  onChange={(e) => setSearchParams({ ...searchParams, last_name: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Phone"
                  size="small"
                  value={searchParams.phone}
                  onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button 
                  variant="contained" 
                  fullWidth 
                  onClick={handleSearch}
                  disabled={searching}
                >
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
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Gender</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searchResults.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell>{patient.first_name} {patient.last_name}</TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{patient.gender}</TableCell>
                            <TableCell>{patient.phone}</TableCell>
                            <TableCell align="right">
                              <Button 
                                variant="outlined" 
                                size="small"
                                onClick={() => startEncounter(patient.id!, `${patient.first_name} ${patient.last_name}`)}
                                disabled={loading}
                              >
                                Start Encounter
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No patients found. Please use the registration form to add a new patient.</Alert>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Registration Form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <PersonAddIcon sx={{ mr: 1 }} /> Register New Patient
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <form onSubmit={handleRegisterAndStart}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="First Name"
                    required
                    value={newPatient.first_name}
                    onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    required
                    value={newPatient.last_name}
                    onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="Gender"
                    required
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    required
                    InputLabelProps={{ shrink: true }}
                    helperText={country ? `Format: ${country.dateFormat}` : ''}
                    value={newPatient.date_of_birth}
                    onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    required
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Village"
                    required
                    value={newPatient.village}
                    onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    size="large"
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : "Register & Start Encounter"}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RegistrationStation;
