import React, { 
  useState, 
  useEffect,
  useCallback
} from 'react';
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
  Select,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Stack,
  InputAdornment,
  Switch,
  FormControlLabel,
  FormGroup,
  FormLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import PatientPhotoCapture from '../components/PatientPhotoCapture';
import QrScannerModal from '../components/QrScannerModal';
import { 
  searchPatients, 
  updatePatient 
} from '../services/patientService';
import { 
  getPatientByQrToken 
} from '../services/qrService';
import { 
  createEncounter 
} from '../services/encounterService';
import { 
  addToQueue 
} from '../services/queueService';
import { 
  Patient 
} from '../types';
import { 
  getPatientSchema 
} from '../schemas/clinical';
import { 
  useAppStore 
} from '../store/useAppStore';
import { 
  db 
} from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { 
  handleFirestoreError, 
  OperationType 
} from '../utils/firestoreError';
import { 
  getCountryConfig 
} from '../config/useCountry';
import StationLayout from '../components/StationLayout';
import { 
  useResponsiveLayout 
} from '../hooks/useResponsiveLayout';

// =============================================================================
// REGISTRATION STATION (Sacred UI Architecture v2.0)
// =============================================================================
// This component implements a high-throughput clinical intake workflow.
// It is specifically optimized for tablet deployment in resource-constrained
// environments, featuring large touch targets and high-visibility typography.
//
// CRITICAL: This file maintains a verbose, non-compressed structure to ensure
// maximum readability and maintainability for field engineers.
// =============================================================================

interface RegistrationStationProps {
  countryId: string;
}

const RegistrationStation: React.FC<RegistrationStationProps> = ({ 
  countryId 
}) => {
  // --- CONFIGURATION & HOOKS ---
  const countryConfig = getCountryConfig(countryId);
  const { 
    notify, 
    selectedClinic, 
    selectedCountry, 
    userProfile,
    setSelectedPatient
  } = useAppStore();
  
  const { 
    isMobile, 
    isTablet 
  } = useResponsiveLayout();
  
  // --- SEARCH & UI STATE ---
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
  
  // --- MODAL & BADGE STATE ---
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [badgeData, setBadgeData] = useState<{ 
    patientId: string; 
    name: string; 
    qrCode: string; 
    photoUrl?: string; 
    clinicName?: string 
  } | null>(null);

  // --- FORM PERSISTENCE STATE ---
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | undefined>(undefined);
  const [currentPatientId, setCurrentPatientId] = useState<string>(
    doc(collection(db, 'patients')).id
  );
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    'Basic Information', 
    'Identity & Credentials', 
    'Address & Contact'
  ];

  // --- PATIENT DATA MODEL ---
  const initialPatientState = {
    given_name: '',
    middle_name: '',
    family_name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '',
    estimated_birth_year: '' as string | number,
    is_minor: false,
    parent_name: '',
    parent_id: '',
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
    upazila: '',
    union: '',
    post_code: '',
    district: '',
    country: '',
    permanent_address_same_as_present: true,
    perm_address_line: '',
    perm_village: '',
    perm_district: '',
    perm_upazila: '',
    perm_union: '',
    perm_post_code: '',
    perm_country: ''
  };

  const [newPatient, setNewPatient] = useState(initialPatientState);

  // --- VALIDATION STATE ---
  const [validationErrors, setValidationErrors] = useState({
    national_id: '',
    rohingya_number: '',
    nepal_id: '',
    bhutanese_refugee_number: '',
    date_of_birth: ''
  });

  // ===========================================================================
  // VALIDATION LOGIC (RESTORED REGEX SUITE)
  // ===========================================================================

  /**
   * Date of Birth Validation (DD/MM/YYYY)
   */
  const validateDOB = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(trimmed)) return "Invalid format. Use DD/MM/YYYY.";
    const [_, day, month, year] = trimmed.match(regex)!;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12) return "Invalid month.";
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d < 1 || d > daysInMonth) return "Invalid day for this month.";
    const currentYear = new Date().getFullYear();
    if (y < 1900 || y > currentYear) return "Invalid year.";
    return '';
  }, []);

  /**
   * Bangladesh National ID (NID) Validation
   * Requirement: Exactly 10, 13, or 17 digits.
   */
  const validateNID = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const regex = /^(\d{10}|\d{13}|\d{17})$/;
    return regex.test(trimmed) ? '' : "Invalid NID. Must be exactly 10, 13, or 17 digits.";
  }, []);

  /**
   * MoHA / Rohingya Number Validation
   * Requirement: Alphanumeric with a dash (8–15 chars) OR a 17-digit MoHA number starting with '1'.
   */
  const validateRohingyaNumber = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const patternA = /^(?=.*-)[a-zA-Z0-9-]{8,15}$/;
    const patternB = /^1\d{16}$/;
    return (patternA.test(trimmed) || patternB.test(trimmed)) 
      ? '' 
      : "Invalid MoHA format. Must be 8-15 chars with dash OR 17 digits starting with '1'.";
  }, []);

  /**
   * Nepal Identity Validation
   * Requirement: 
   * - Nepali Citizen: Exactly 10 digits.
   * - Bhutanese Refugee: 5–8 digits (RC) OR 10–12 digits (UNHCR).
   */
  const validateNepalID = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const regex = /^\d{10}$/;
    return regex.test(trimmed) ? '' : "Invalid Citizen ID. Must be exactly 10 digits.";
  }, []);

  const validateBhutaneseRefugeeNumber = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const isRC = /^\d{5,8}$/.test(trimmed);
    const isUNHCR = /^\d{10,12}$/.test(trimmed);
    return (isRC || isUNHCR) 
      ? '' 
      : "Invalid Refugee ID. Must be 5-8 digits (RC) or 10-12 digits (UNHCR).";
  }, []);

  // --- FIELD CHANGE HANDLERS ---

  const handleFieldChange = (field: string, value: any) => {
    if (field === 'permanent_address_same_as_present' && value === true) {
      setNewPatient(prev => ({
        ...prev,
        permanent_address_same_as_present: true,
        perm_address_line: prev.address_line,
        perm_village: prev.village,
        perm_district: prev.district,
        perm_upazila: prev.upazila,
        perm_union: prev.union,
        perm_post_code: prev.post_code,
        perm_country: prev.country
      }));
      return;
    }
    
    setNewPatient(prev => ({ ...prev, [field]: value }));
    
    // Real-time validation trigger
    if (field === 'date_of_birth') {
      setValidationErrors(prev => ({ ...prev, date_of_birth: validateDOB(value) }));
    }
    
    if (selectedCountry?.id === 'BD') {
      if (field === 'national_id') {
        setValidationErrors(prev => ({ ...prev, national_id: validateNID(value) }));
      } else if (field === 'rohingya_number') {
        setValidationErrors(prev => ({ ...prev, rohingya_number: validateRohingyaNumber(value) }));
      }
    } else if (selectedCountry?.id === 'NP') {
      if (field === 'nepal_id') {
        setValidationErrors(prev => ({ ...prev, nepal_id: validateNepalID(value) }));
      } else if (field === 'bhutanese_refugee_number') {
        setValidationErrors(prev => ({ ...prev, bhutanese_refugee_number: validateBhutaneseRefugeeNumber(value) }));
      }
    }
  };

  const handleFieldBlur = (field: string) => {
    const value = (newPatient as any)[field] || '';
    
    // Final check validation trigger
    if (field === 'date_of_birth') {
      setValidationErrors(prev => ({ ...prev, date_of_birth: validateDOB(value) }));
    }

    if (selectedCountry?.id === 'BD') {
      if (field === 'national_id') {
        setValidationErrors(prev => ({ ...prev, national_id: validateNID(value) }));
      } else if (field === 'rohingya_number') {
        setValidationErrors(prev => ({ ...prev, rohingya_number: validateRohingyaNumber(value) }));
      }
    } else if (selectedCountry?.id === 'NP') {
      if (field === 'nepal_id') {
        setValidationErrors(prev => ({ ...prev, nepal_id: validateNepalID(value) }));
      } else if (field === 'bhutanese_refugee_number') {
        setValidationErrors(prev => ({ ...prev, bhutanese_refugee_number: validateBhutaneseRefugeeNumber(value) }));
      }
    }
  };

  // ===========================================================================
  // RBAC & ACCESS CONTROL
  // ===========================================================================

  if (userProfile && !userProfile.isApproved && userProfile.role !== 'global_admin') {
    return (
      <StationLayout 
        title="Registration Station" 
        stationName="Registration" 
        showPatientContext={false}
      >
        <Box 
          sx={{ 
            p: 8, 
            textAlign: 'center',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 4,
              borderRadius: 4, 
              fontWeight: 900,
              width: '100%',
              maxWidth: 600,
              p: 3,
              fontSize: '1.2rem'
            }}
          >
            ACCOUNT PENDING APPROVAL: Your medical credentials must be verified 
            before you can register patients into the clinical registry.
          </Alert>
          <Typography 
            variant="h5"
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            Contact System Administrator (Dhaka Office) to activate your account.
          </Typography>
        </Box>
      </StationLayout>
    );
  }

  // --- SEARCH HANDLER ---
  const handleSearch = async () => {
    if (
      !searchParams.given_name && 
      !searchParams.family_name && 
      !searchParams.phone && 
      !searchParams.national_id && 
      !searchParams.rohingya_number &&
      !searchParams.nepal_id &&
      !searchParams.bhutanese_refugee_number
    ) {
      notify("Please provide a name or identity number to search.", "warning");
      return;
    }
    
    setSearching(true);
    try {
      const results = await searchPatients({ ...searchParams });
      setSearchResults(results);
      setSearchPerformed(true);
    } catch (error: any) {
      notify(`Search Failed: ${error.message}`, "error");
    } finally {
      setSearching(false);
    }
  };

  // --- ENCOUNTER HANDLER ---
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
      notify(`Queue position secured for ${patientName}`, "success");
    } catch (error: any) {
      notify(`Queue Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatientId(patient.id!);
    setCurrentPatientId(patient.id!);
    setPatientPhotoUrl(patient.photo_url);
    setNewPatient({ ...patient } as any);
    setActiveStep(0);
  };

  const handleNext = () => {
    // Step 0 Validation: Given Name, Family Name, and (DOB or Estimated Birth Year)
    if (activeStep === 0) {
      const errors: string[] = [];
      if (!newPatient.given_name.trim()) errors.push("Given Name is required.");
      if (!newPatient.family_name.trim()) errors.push("Family Name is required.");
      if (!newPatient.date_of_birth.trim() && !newPatient.estimated_birth_year) {
        errors.push("Either Date of Birth or Estimated Birth Year must be provided.");
      }
      if (!patientPhotoUrl) {
        errors.push("Patient photo is required.");
      }

      if (errors.length > 0) {
        notify(errors.join(" "), "error");
        return;
      }
    }

    // Step 1 Validation: Marital Status
    if (activeStep === 1) {
      if (!newPatient.marital_status) {
        notify("Marital status is required.", "error");
        return;
      }
    }

    // Check for validation errors before proceeding
    const hasErrors = Object.values(validationErrors).some(err => err !== '');
    if (hasErrors) {
      notify("Please correct the validation errors before proceeding.", "error");
      return;
    }

    if (activeStep === steps.length - 1) {
      handleRegisterOrUpdate();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  // ===========================================================================
  // STEP RENDERER (SACRED UI VERBOSE SYNTAX)
  // ===========================================================================

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // BASIC INFO
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ mb: 6, display: 'flex', justifyContent: 'center' }}>
                <PatientPhotoCapture 
                  patientId={currentPatientId} 
                  onPhotoUploaded={setPatientPhotoUrl} 
                  currentPhoto={patientPhotoUrl} 
                />
              </Box>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField 
                fullWidth 
                label="Given Name" 
                required 
                value={newPatient.given_name} 
                onChange={(e) => handleFieldChange('given_name', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField 
                fullWidth 
                label="Middle Name" 
                value={newPatient.middle_name} 
                onChange={(e) => handleFieldChange('middle_name', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField 
                fullWidth 
                label="Family Name" 
                required 
                value={newPatient.family_name} 
                onChange={(e) => handleFieldChange('family_name', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                select 
                label="Gender" 
                required 
                value={newPatient.gender} 
                onChange={(e) => handleFieldChange('gender', e.target.value as any)}
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              >
                <MenuItem value="male" sx={{ fontSize: '1.2rem', py: 2 }}>Male</MenuItem>
                <MenuItem value="female" sx={{ fontSize: '1.2rem', py: 2 }}>Female</MenuItem>
                <MenuItem value="other" sx={{ fontSize: '1.2rem', py: 2 }}>Other</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Date of Birth" 
                placeholder="DD/MM/YYYY"
                helperText={validationErrors.date_of_birth || "Format: DD/MM/YYYY (Required if Birth Year empty)"}
                error={!!validationErrors.date_of_birth}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                value={newPatient.date_of_birth} 
                onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                onBlur={() => handleFieldBlur('date_of_birth')}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Estimated Birth Year" 
                type="number"
                placeholder="e.g. 1980"
                helperText="Required if Date of Birth is empty"
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                value={newPatient.estimated_birth_year} 
                onChange={(e) => handleFieldChange('estimated_birth_year', e.target.value)}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Country" 
                disabled
                value={selectedCountry?.name || ''} 
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                sx={{ bgcolor: '#f1f5f9' }}
              />
            </Grid>
          </Grid>
        );
      case 1: // IDENTITY & CREDENTIALS
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <FormControl component="fieldset" variant="standard">
                <FormControlLabel
                  control={
                    <Switch 
                      checked={newPatient.is_minor} 
                      onChange={(e) => handleFieldChange('is_minor', e.target.checked)} 
                      color="primary"
                    />
                  }
                  label={<Typography variant="h6" fontWeight="700">Is this patient a minor?</Typography>}
                />
              </FormControl>
            </Grid>

            {newPatient.is_minor && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Parent / Guardian Name" 
                    required={newPatient.is_minor}
                    value={newPatient.parent_name} 
                    onChange={(e) => handleFieldChange('parent_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Parent / Guardian ID Number" 
                    required={newPatient.is_minor}
                    value={newPatient.parent_id} 
                    onChange={(e) => handleFieldChange('parent_id', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Primary Contact Number" 
                value={newPatient.phone} 
                onChange={(e) => handleFieldChange('phone', e.target.value)} 
                InputProps={{ 
                  sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                  startAdornment: (
                    <InputAdornment position="start">
                      <ContactPhoneIcon color="primary" />
                    </InputAdornment>
                  )
                }}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                select 
                label="Marital Status" 
                required 
                value={newPatient.marital_status} 
                onChange={(e) => handleFieldChange('marital_status', e.target.value)}
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              >
                <MenuItem value="single" sx={{ fontSize: '1.2rem', py: 2 }}>Single</MenuItem>
                <MenuItem value="married" sx={{ fontSize: '1.2rem', py: 2 }}>Married</MenuItem>
                <MenuItem value="divorced" sx={{ fontSize: '1.2rem', py: 2 }}>Divorced</MenuItem>
                <MenuItem value="widowed" sx={{ fontSize: '1.2rem', py: 2 }}>Widowed</MenuItem>
              </TextField>
            </Grid>
            
            {/* CONDITIONAL IDENTITY FIELDS: BANGLADESH */}
            {selectedCountry?.id === 'BD' && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="National ID (NID)" 
                    value={newPatient.national_id} 
                    error={!!validationErrors.national_id}
                    helperText={validationErrors.national_id}
                    onChange={(e) => handleFieldChange('national_id', e.target.value)}
                    onBlur={() => handleFieldBlur('national_id')}
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon color="primary" />
                        </InputAdornment>
                      )
                    }}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="MoHA / Rohingya Number" 
                    value={newPatient.rohingya_number} 
                    error={!!validationErrors.rohingya_number}
                    helperText={validationErrors.rohingya_number}
                    onChange={(e) => handleFieldChange('rohingya_number', e.target.value)}
                    onBlur={() => handleFieldBlur('rohingya_number')}
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <FingerprintIcon color="primary" />
                        </InputAdornment>
                      )
                    }}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </>
            )}

            {/* CONDITIONAL IDENTITY FIELDS: NEPAL */}
            {selectedCountry?.id === 'NP' && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Nepali Citizen ID" 
                    value={newPatient.nepal_id} 
                    error={!!validationErrors.nepal_id}
                    helperText={validationErrors.nepal_id}
                    onChange={(e) => handleFieldChange('nepal_id', e.target.value)}
                    onBlur={() => handleFieldBlur('nepal_id')}
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon color="primary" />
                        </InputAdornment>
                      )
                    }}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Bhutanese Refugee ID (RC/UNHCR)" 
                    value={newPatient.bhutanese_refugee_number} 
                    error={!!validationErrors.bhutanese_refugee_number}
                    helperText={validationErrors.bhutanese_refugee_number}
                    onChange={(e) => handleFieldChange('bhutanese_refugee_number', e.target.value)}
                    onBlur={() => handleFieldBlur('bhutanese_refugee_number')}
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <FingerprintIcon color="primary" />
                        </InputAdornment>
                      )
                    }}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
      case 2: // ADDRESS & CONTACT
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Village / Ward / Camp" 
                value={newPatient.village} 
                onChange={(e) => handleFieldChange('village', e.target.value)} 
                InputProps={{ 
                  sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 },
                  startAdornment: (
                    <InputAdornment position="start">
                      <HomeIcon color="primary" />
                    </InputAdornment>
                  )
                }}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="District / Province" 
                value={newPatient.district} 
                onChange={(e) => handleFieldChange('district', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Upazila" 
                value={newPatient.upazila} 
                onChange={(e) => handleFieldChange('upazila', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Union" 
                value={newPatient.union} 
                onChange={(e) => handleFieldChange('union', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Post Code" 
                value={newPatient.post_code} 
                onChange={(e) => handleFieldChange('post_code', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField 
                fullWidth 
                label="Detailed Address Information" 
                multiline 
                rows={2} 
                value={newPatient.address_line} 
                onChange={(e) => handleFieldChange('address_line', e.target.value)} 
                InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 700, p: 3 }}}
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 4 }}>
                <Chip label="PERMANENT ADDRESS" sx={{ fontWeight: 900, fontSize: '1rem' }} />
              </Divider>
              <FormControlLabel
                control={
                  <Switch 
                    checked={newPatient.permanent_address_same_as_present} 
                    onChange={(e) => handleFieldChange('permanent_address_same_as_present', e.target.checked as any)} 
                    color="primary"
                  />
                }
                label={<Typography variant="h6" fontWeight="700">Same as present address</Typography>}
              />
            </Grid>

            {!newPatient.permanent_address_same_as_present && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Village / Ward / Camp (Permanent)" 
                    value={newPatient.perm_village} 
                    onChange={(e) => handleFieldChange('perm_village', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="District / Province (Permanent)" 
                    value={newPatient.perm_district} 
                    onChange={(e) => handleFieldChange('perm_district', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Upazila (Permanent)" 
                    value={newPatient.perm_upazila} 
                    onChange={(e) => handleFieldChange('perm_upazila', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Union (Permanent)" 
                    value={newPatient.perm_union} 
                    onChange={(e) => handleFieldChange('perm_union', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Post Code (Permanent)" 
                    value={newPatient.perm_post_code} 
                    onChange={(e) => handleFieldChange('perm_post_code', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Country (Permanent)" 
                    value={newPatient.perm_country} 
                    onChange={(e) => handleFieldChange('perm_country', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField 
                    fullWidth 
                    label="Detailed Address (Permanent)" 
                    multiline 
                    rows={2} 
                    value={newPatient.perm_address_line} 
                    onChange={(e) => handleFieldChange('perm_address_line', e.target.value)} 
                    InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 700, p: 3 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
      default:
        return null;
    }
  };

  // --- PERSISTENCE HANDSHAKE ---
  const handleRegisterOrUpdate = async () => {
    if (!selectedClinic || !selectedCountry) return;
    
    // Final validation check
    const hasErrors = Object.values(validationErrors).some(err => err !== '');
    if (hasErrors) {
      notify("Cannot finalize: Please resolve validation errors.", "error");
      return;
    }

    setLoading(true);
    try {
      const patientData: any = {
        ...newPatient,
        estimated_birth_year: newPatient.estimated_birth_year ? Number(newPatient.estimated_birth_year) : null,
        country_id: selectedCountry.id,
        clinic_id: selectedClinic.id,
        photo_url: patientPhotoUrl || null,
        updated_at: serverTimestamp()
      };

      if (!editingPatientId) {
        patientData.created_at = serverTimestamp();
        await setDoc(doc(db, 'patients', currentPatientId), patientData);
        
        // Badge Generation logic
        const qrToken = `HAEFA-${currentPatientId.slice(0, 8)}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrToken);
        await setDoc(doc(db, 'badge_tokens', qrToken), {
          patient_id: currentPatientId,
          created_at: serverTimestamp(),
          clinic_id: selectedClinic.id,
          country_id: selectedCountry.id
        });

        setBadgeData({
          patientId: currentPatientId,
          name: `${newPatient.given_name} ${newPatient.family_name}`,
          qrCode: qrCodeDataUrl,
          photoUrl: patientPhotoUrl,
          clinicName: selectedClinic.name
        });
        setShowBadgeModal(true);
      } else {
        await updatePatient(editingPatientId, patientData);
      }

      const encounterId = await createEncounter(currentPatientId);
      await addToQueue({
        patient_id: currentPatientId,
        patient_name: `${newPatient.given_name} ${newPatient.family_name}`,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals'
      });
      
      setSuccessMsg("Success: Record finalized and patient queued for triage.");
      setNewPatient(initialPatientState);
      setPatientPhotoUrl(undefined);
      setCurrentPatientId(doc(collection(db, 'patients')).id);
      setActiveStep(0);
      setEditingPatientId(null);
    } catch (error: any) {
      notify(`System Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- PRINT HANDLER ---
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !badgeData) return;

    const html = `
      <html>
        <head>
          <title>Health Card - ${badgeData.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: 85.6mm 54mm; margin: 0; }
            }
            body { 
              font-family: 'Inter', sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0;
              background: #f0f2f5;
            }
            .card {
              width: 85.6mm;
              height: 54mm;
              background: white;
              border: 1px solid #004d40;
              border-radius: 4px;
              padding: 8px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
              text-align: center;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 4px;
              border-bottom: 1.5px solid #004d40;
              padding-bottom: 4px;
              text-align: center;
            }
            .org-name {
              font-size: 9px;
              font-weight: 900;
              color: #333;
              text-transform: uppercase;
              line-height: 1.1;
              text-align: center;
              width: 100%;
            }
            .card-title {
              font-size: 14px;
              font-weight: 900;
              color: #00796b;
              margin: 2px 0;
            }
            .clinic-name {
              font-size: 11px;
              font-weight: 800;
              color: #333;
              margin-bottom: 2px;
            }
            .patient-name {
              font-size: 13px;
              font-weight: 900;
              margin-bottom: 1px;
              color: #1a237e;
            }
            .id-no {
              font-size: 11px;
              font-weight: 800;
              color: #444;
              margin-bottom: 4px;
            }
            .card-content {
              display: flex;
              flex-direction: row;
              gap: 12px;
              flex: 1;
              align-items: center;
              text-align: left;
              padding: 4px 0;
            }
            .photo-container {
              width: 20mm;
              height: 24mm;
              border: 1px solid #004d40;
              background: #f9f9f9;
              overflow: hidden;
              display: flex;
              justify-content: center;
              align-items: center;
              border-radius: 2px;
            }
            .photo-container img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .info-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .qr-container {
              position: absolute;
              bottom: 6px;
              right: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .qr-code {
              width: 14mm;
              height: 14mm;
            }
            .footer {
              font-size: 6px;
              color: #999;
              position: absolute;
              bottom: 4px;
              left: 8px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="org-name">HEALTH AND EDUCATION FOR ALL, USA</div>
            </div>
            <div class="card-title">Health Card</div>
            <div class="card-content">
              <div class="photo-container">
                ${badgeData.photoUrl ? `<img src="${badgeData.photoUrl}" />` : '<div style="font-size: 8px; color: #999;">NO PHOTO</div>'}
              </div>
              <div class="info-container">
                <div class="clinic-name">${badgeData.clinicName || 'N/A'}</div>
                <div class="patient-name">${badgeData.name}</div>
                <div class="id-no">ID: ${badgeData.patientId.slice(0, 12).toUpperCase()}</div>
              </div>
            </div>
            <div class="qr-container">
              <img src="${badgeData.qrCode}" class="qr-code" />
            </div>
            <div class="footer">HAEFA Clinical Registry System</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  return (
    <StationLayout 
      title="Registration Station" 
      stationName="Registration" 
      showPatientContext={false}
    >
      <Box sx={{ mb: 6 }}>
        <Typography variant="h3" fontWeight="900" color="primary" gutterBottom sx={{ letterSpacing: '-0.03em' }}>
          PARTICIPANT INTAKE
        </Typography>
        <Typography variant="h6" color="text.secondary" fontWeight="600">
          {selectedClinic?.name} • {selectedCountry?.name} Clinical Registry
        </Typography>
      </Box>

      {successMsg && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon fontSize="large" />}
          sx={{ mb: 6, borderRadius: 4, fontWeight: 800, fontSize: '1.2rem', p: 3 }}
        >
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={6}>
        {/* SEARCH & LOOKUP WING */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <Box sx={{ bgcolor: 'primary.main', p: 3, color: 'white' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <SearchIcon sx={{ fontSize: 32 }} />
                <Typography variant="h5" fontWeight="900">SYSTEM SEARCH</Typography>
              </Stack>
            </Box>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ mb: 6 }}>
                <QrScannerModal onScan={handleSearch as any} />
              </Box>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Given Name" 
                    value={searchParams.given_name}
                    onChange={(e) => setSearchParams({ ...searchParams, given_name: e.target.value })}
                    InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Family Name" 
                    value={searchParams.family_name}
                    onChange={(e) => setSearchParams({ ...searchParams, family_name: e.target.value })}
                    InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                  />
                </Grid>
                
                {selectedCountry?.id === 'BD' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="National ID" 
                        value={searchParams.national_id}
                        onChange={(e) => setSearchParams({ ...searchParams, national_id: e.target.value })}
                        InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="Rohingya Number" 
                        value={searchParams.rohingya_number}
                        onChange={(e) => setSearchParams({ ...searchParams, rohingya_number: e.target.value })}
                        InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                      />
                    </Grid>
                  </>
                )}

                {selectedCountry?.id === 'NP' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="Nepal ID" 
                        value={searchParams.nepal_id}
                        onChange={(e) => setSearchParams({ ...searchParams, nepal_id: e.target.value })}
                        InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="Bhutanese Refugee ID" 
                        value={searchParams.bhutanese_refugee_number}
                        onChange={(e) => setSearchParams({ ...searchParams, bhutanese_refugee_number: e.target.value })}
                        InputProps={{ sx: { height: 70, fontSize: '1.2rem', fontWeight: 700 }}}
                      />
                    </Grid>
                  </>
                )}

                <Grid size={{ xs: 12 }}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSearch}
                    disabled={searching}
                    sx={{ height: 80, fontWeight: 900, borderRadius: 3, fontSize: '1.5rem', boxShadow: 4 }}
                  >
                    {searching ? <CircularProgress size={32} color="inherit" /> : "EXECUTE QUERY"}
                  </Button>
                </Grid>
              </Grid>

              {searchPerformed && (
                <Box sx={{ mt: 6 }}>
                  <Typography variant="overline" fontWeight="900" color="text.secondary" sx={{ letterSpacing: 2 }}>
                    SEARCH RESULTS ({searchResults.length})
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  {searchResults.length === 0 ? (
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No matching records found in the registry.
                    </Typography>
                  ) : (
                    searchResults.map((p) => (
                      <Paper 
                        key={p.id} 
                        variant="outlined" 
                        sx={{ 
                          p: 3, 
                          mb: 2, 
                          borderRadius: 4, 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '2px solid #f1f5f9',
                          '&:hover': { borderColor: 'primary.light', bgcolor: '#f8fafc' }
                        }}
                      >
                        <Box>
                          <Typography variant="h6" fontWeight="800">
                            {p.given_name} {p.family_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight="600">
                            {p.gender?.toUpperCase() || 'N/A'} • {p.phone || 'NO CONTACT'} • ID: {p.national_id || p.rohingya_number || p.nepal_id || 'N/A'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Reprint Health Card">
                            <IconButton 
                              color="info" 
                              onClick={async () => {
                                const qrToken = `HAEFA-${p.id!.slice(0, 8)}`;
                                const qrCodeDataUrl = await QRCode.toDataURL(qrToken);
                                setBadgeData({
                                  patientId: p.id!,
                                  name: `${p.given_name} ${p.family_name}`,
                                  qrCode: qrCodeDataUrl,
                                  photoUrl: p.photo_url,
                                  clinicName: selectedClinic?.name
                                });
                                setShowBadgeModal(true);
                              }} 
                              sx={{ bgcolor: 'info.50' }}
                            >
                              <PrintIcon />
                            </IconButton>
                          </Tooltip>
                          <IconButton color="secondary" onClick={() => handleEditPatient(p)} sx={{ bgcolor: 'secondary.50' }}>
                            <EditIcon />
                          </IconButton>
                          <Button 
                            variant="contained" 
                            color="success" 
                            onClick={() => startEncounter(p.id!, `${p.given_name} ${p.family_name}`)}
                            sx={{ fontWeight: 900, borderRadius: 2 }}
                          >
                            START
                          </Button>
                        </Stack>
                      </Paper>
                    ))
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* REGISTRATION & INTAKE WING */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
            <Box sx={{ bgcolor: editingPatientId ? 'secondary.main' : 'success.main', p: 3, color: 'white' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <PersonAddIcon sx={{ fontSize: 32 }} />
                <Typography variant="h5" fontWeight="900">
                  {editingPatientId ? 'PROFILE SYNCHRONIZATION' : 'NEW PARTICIPANT REGISTRATION'}
                </Typography>
              </Stack>
            </Box>
            <CardContent sx={{ p: 6 }}>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel>
                      <Typography variant="h6" fontWeight="900" color={activeStep === index ? 'primary' : 'text.secondary'}>
                        {label}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      <Box sx={{ py: 6 }}>
                        {renderStepContent(index)}
                      </Box>
                      <Stack direction="row" spacing={3} sx={{ mt: 4 }}>
                        <Button 
                          variant="contained" 
                          color="primary" 
                          onClick={handleNext}
                          disabled={loading}
                          sx={{ height: 80, px: 8, fontWeight: 900, borderRadius: 3, fontSize: '1.5rem', boxShadow: 4 }}
                        >
                          {loading ? <CircularProgress size={32} color="inherit" /> : (activeStep === steps.length - 1 ? 'FINALIZE RECORD' : 'CONTINUE')}
                        </Button>
                        <Button 
                          disabled={activeStep === 0 || loading} 
                          onClick={handleBack}
                          sx={{ height: 80, px: 4, fontWeight: 800, fontSize: '1.2rem' }}
                        >
                          BACK
                        </Button>
                      </Stack>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* BADGE MODAL (SACRED UI VERSION) */}
      <Modal open={showBadgeModal} onClose={() => setShowBadgeModal(false)}>
        <Box sx={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
          bgcolor: 'white', p: 6, borderRadius: 8, width: 550, textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
        }}>
          <Typography variant="h4" fontWeight="900" color="primary" gutterBottom sx={{ mb: 4 }}>
            HEALTH CARD GENERATED
          </Typography>
          {badgeData && (
            <Box sx={{ 
              p: 3, 
              border: '2px solid #004d40', 
              borderRadius: 4, 
              bgcolor: 'white', 
              mb: 6,
              textAlign: 'center',
              position: 'relative',
              boxShadow: 3,
              minHeight: 250,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Card Header */}
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 1, borderBottom: '2px solid #004d40', pb: 1, textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="900" sx={{ fontSize: '1.1rem', color: '#333', lineHeight: 1.2, textAlign: 'center', width: '100%' }}>
                  HEALTH AND EDUCATION FOR ALL, USA
                </Typography>
              </Stack>

              <Typography variant="h5" fontWeight="900" sx={{ color: '#00796b', mb: 2, letterSpacing: 1 }}>
                Health Card
              </Typography>

              <Stack direction="row" spacing={3} sx={{ flex: 1, alignItems: 'center' }}>
                {/* Photo Column */}
                <Box sx={{ 
                  width: 120, 
                  height: 150, 
                  border: '2px solid #004d40', 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  bgcolor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {badgeData.photoUrl ? (
                    <Box component="img" src={badgeData.photoUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">NO PHOTO</Typography>
                  )}
                </Box>

                {/* Info Column */}
                <Box sx={{ textAlign: 'left', flex: 1 }}>
                  <Typography variant="h6" fontWeight="800" sx={{ mb: 0.5, color: '#333', fontSize: '1rem' }}>
                    {badgeData.clinicName}
                  </Typography>

                  <Typography variant="h5" fontWeight="900" sx={{ mb: 0.5, fontSize: '1.4rem', color: '#1a237e' }}>
                    {badgeData.name}
                  </Typography>

                  <Typography variant="h6" color="text.secondary" fontWeight="800" sx={{ mb: 2, fontSize: '1.1rem' }}>
                    ID: {badgeData.patientId.slice(0, 12).toUpperCase()}
                  </Typography>
                </Box>

                {/* QR Column */}
                <Box sx={{ textAlign: 'center' }}>
                  <Box 
                    component="img" 
                    src={badgeData.qrCode} 
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      p: 0.5, 
                      bgcolor: 'white', 
                      border: '1px solid #eee' 
                    }} 
                  />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.6rem' }}>
                    SCAN TO VERIFY
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
          <Stack spacing={2}>
            <Button 
              fullWidth 
              variant="contained" 
              color="success" 
              size="large" 
              onClick={handlePrint}
              sx={{ height: 80, fontWeight: 900, borderRadius: 4, fontSize: '1.5rem' }}
            >
              PRINT IDENTIFICATION
            </Button>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setShowBadgeModal(false)}
              sx={{ height: 60, fontWeight: 800, borderRadius: 3 }}
            >
              CLOSE
            </Button>
          </Stack>
        </Box>
      </Modal>
    </StationLayout>
  );
};

export default RegistrationStation;
