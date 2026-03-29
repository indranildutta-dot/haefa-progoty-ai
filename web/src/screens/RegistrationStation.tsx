import React, { 
  useState, 
  useEffect 
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
  StepContent
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PatientPhotoCapture from '../components/PatientPhotoCapture';
import QrScannerModal from '../components/QrScannerModal';
import { 
  searchPatients, 
  updatePatient 
} from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { createEncounter } from '../services/encounterService';
import { addToQueue } from '../services/queueService';
import { Patient } from '../types';
import { getPatientSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
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

import { getCountryConfig } from '../config/useCountry';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface RegistrationStationProps {
  countryId: string;
}

const RegistrationStation: React.FC<RegistrationStationProps> = ({ 
  countryId 
}) => {
  const countryConfig = getCountryConfig(countryId);
  
  const { 
    notify, 
    selectedClinic, 
    selectedCountry, 
    userProfile 
  } = useAppStore();
  
  const { 
    isMobile, 
    isTablet 
  } = useResponsiveLayout();
  
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
  
  const [badgeData, setBadgeData] = useState<{ 
    patientId: string; 
    name: string; 
    qrCode: string; 
    photoUrl?: string; 
    clinicName?: string 
  } | null>(null);

  /**
   * SESSION MANAGEMENT FIX:
   * We pre-allocate the Firestore ID so that the PatientPhotoCapture component
   * has a valid folder path in Storage BEFORE the patient record is officially saved.
   */
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | undefined>(undefined);
  const [currentPatientId, setCurrentPatientId] = useState<string>(
    doc(collection(db, 'patients')).id
  );
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    'Basic Info', 
    'Identity', 
    'Address'
  ];

  /**
   * RBAC PROTECTION:
   * Ensures staged accounts cannot register participants until approved.
   */
  if (userProfile && !userProfile.isApproved && userProfile.role !== 'global_admin') {
    return (
      <StationLayout 
        title="Registration Station" 
        stationName="Registration" 
        showPatientContext={false}
      >
        <Box 
          sx={{ 
            p: 3, 
            textAlign: 'center' 
          }}
        >
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              borderRadius: 3,
              fontWeight: 900
            }}
          >
            ACCOUNT PENDING APPROVAL: Your clinical permissions must be activated 
            by an administrator before patient registration is enabled.
          </Alert>
          <Typography 
            variant="body1"
          >
            Please contact your Country Lead or Global Admin for approval.
          </Typography>
        </Box>
      </StationLayout>
    );
  }

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

  /**
   * VALIDATION SUITE (Restored to expanded multi-line logic)
   */
  const validateNID = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const regex = /^(\d{10}|\d{13}|\d{17})$/;
    if (!regex.test(trimmed)) {
      return "Invalid NID. Must be 10, 13, or 17 digits.";
    }
    return '';
  };

  const validateRohingyaNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const patternA = /^(?=.*-)[a-zA-Z0-9-]{8,15}$/;
    const patternB = /^1\d{16}$/;
    if (!patternA.test(trimmed) && !patternB.test(trimmed)) {
      return "Format must be alphanumeric with a dash or a 17-digit MoHA number.";
    }
    return '';
  };

  const validateNepalID = (
    value: string, 
    patientType: string
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    
    if (patientType === 'Nepali Citizen') {
      if (!/^\d{10}$/.test(trimmed)) {
        return "Invalid Nepal ID. Must be exactly 10 digits.";
      }
    } else if (patientType === 'Bhutanese Refugee') {
      const isRC = /^\d{5,8}$/.test(trimmed);
      const isUNHCR = /^\d{10,12}$/.test(trimmed);
      if (!isRC && !isUNHCR) {
        return "Invalid ID. Must be 5-8 digits (RC) or 10-12 digits (UNHCR).";
      }
    }
    return '';
  };

  /**
   * SEARCH & ENCOUNTER HANDLERS
   */
  const handleSearch = async () => {
    if (
      !searchParams.given_name && 
      !searchParams.family_name && 
      !searchParams.phone && 
      !searchParams.national_id && 
      !searchParams.rohingya_number && 
      !searchParams.bhutanese_refugee_number && 
      !searchParams.nepal_id
    ) {
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
      console.error("Search Fail:", error);
      notify(`Search Error: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setSearching(false);
    }
  };

  const startEncounter = async (
    patientId: string, 
    patientName: string
  ) => {
    if (!selectedClinic) {
      return;
    }
    
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
    } catch (error: any) {
      console.error("Queue Error:", error);
      notify(`Error starting encounter: ${error.message}`, "error");
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
      nepal_id: patient.patient_type === 'Bhutanese Refugee' 
        ? (patient.bhutanese_refugee_number || '') 
        : (patient.national_id || ''),
      address_type: patient.address_type || '',
      address_line: patient.address_line || '',
      village: patient.village || '',
      thana: patient.thana || '',
      post_code: patient.post_code || '',
      district: patient.district || '',
      country: patient.country || ''
    });
    
    setActiveStep(0);
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleRegisterOrUpdate();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  /**
   * UI STEP RENDERER (Full-Density Restoration)
   */
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // BASIC INFO
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box 
                sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  justifyContent: 'center' 
                }}
              >
                <PatientPhotoCapture 
                  patientId={currentPatientId} 
                  onPhotoUploaded={setPatientPhotoUrl} 
                  currentPhoto={patientPhotoUrl} 
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Given Name" 
                required 
                value={newPatient.given_name} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    given_name: e.target.value 
                  })
                } 
                slotProps={{ 
                  htmlInput: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Family Name" 
                required 
                value={newPatient.family_name} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    family_name: e.target.value 
                  })
                } 
                slotProps={{ 
                  htmlInput: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1, 
                  fontWeight: 'bold' 
                }}
              >
                Age (Year / Month / Day)
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <TextField 
                    fullWidth 
                    label="Year" 
                    type="number" 
                    value={newPatient.age_years} 
                    onChange={(e) => 
                      setNewPatient({ 
                        ...newPatient, 
                        age_years: e.target.value 
                      })
                    } 
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField 
                    fullWidth 
                    label="Month" 
                    type="number" 
                    value={newPatient.age_months} 
                    onChange={(e) => 
                      setNewPatient({ 
                        ...newPatient, 
                        age_months: e.target.value 
                      })
                    } 
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField 
                    fullWidth 
                    label="Day" 
                    type="number" 
                    value={newPatient.age_days} 
                    onChange={(e) => 
                      setNewPatient({ 
                        ...newPatient, 
                        age_days: e.target.value 
                      })
                    } 
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Date of Birth" 
                type="date"
                InputLabelProps={{ shrink: true }} 
                value={newPatient.date_of_birth} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    date_of_birth: e.target.value 
                  })
                }
                slotProps={{ 
                  htmlInput: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                select 
                label="Gender" 
                required 
                value={newPatient.gender} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    gender: e.target.value as any 
                  })
                }
                slotProps={{ 
                  select: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        );
      case 1: // IDENTITY
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Contact No." 
                value={newPatient.phone} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    phone: e.target.value 
                  })
                } 
                slotProps={{ 
                  htmlInput: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                select 
                label="Marital Status" 
                required 
                value={newPatient.marital_status} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    marital_status: e.target.value 
                  })
                }
                slotProps={{ 
                  select: { 
                    style: { 
                      minHeight: '44px' 
                    } 
                  } 
                }}
              >
                <MenuItem value="single">Single</MenuItem>
                <MenuItem value="married">Married</MenuItem>
                <MenuItem value="divorced">Divorced</MenuItem>
                <MenuItem value="widowed">Widowed</MenuItem>
                <MenuItem value="separated">Separated</MenuItem>
              </TextField>
            </Grid>
            {selectedCountry?.id === 'BD' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Bangladesh National ID" 
                    value={newPatient.national_id} 
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, national_id: e.target.value });
                      setValidationErrors({ 
                        ...validationErrors, 
                        national_id: validateNID(e.target.value) 
                      });
                    }}
                    onBlur={(e) => 
                      setValidationErrors({ 
                        ...validationErrors, 
                        national_id: validateNID(e.target.value) 
                      })
                    }
                    error={!!validationErrors.national_id}
                    helperText={validationErrors.national_id}
                    slotProps={{ 
                      htmlInput: { 
                        style: { 
                          minHeight: '44px' 
                        } 
                      } 
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Rohingya Refugee Number" 
                    value={newPatient.rohingya_number} 
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, rohingya_number: e.target.value });
                      setValidationErrors({ 
                        ...validationErrors, 
                        rohingya_number: validateRohingyaNumber(e.target.value) 
                      });
                    }}
                    onBlur={(e) => 
                      setValidationErrors({ 
                        ...validationErrors, 
                        rohingya_number: validateRohingyaNumber(e.target.value) 
                      })
                    }
                    error={!!validationErrors.rohingya_number}
                    helperText={validationErrors.rohingya_number}
                    slotProps={{ 
                      htmlInput: { 
                        style: { 
                          minHeight: '44px' 
                        } 
                      } 
                    }}
                  />
                </Grid>
              </>
            )}
            {selectedCountry?.id === 'NP' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    select 
                    label="Patient Type" 
                    required 
                    value={newPatient.patient_type} 
                    onChange={(e) => {
                      const newType = e.target.value;
                      setNewPatient({ ...newPatient, patient_type: newType });
                      setValidationErrors({ 
                        ...validationErrors, 
                        nepal_id: validateNepalID(newPatient.nepal_id, newType) 
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Identity Number" 
                    value={newPatient.nepal_id} 
                    error={!!validationErrors.nepal_id}
                    helperText={validationErrors.nepal_id}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, nepal_id: e.target.value });
                      setValidationErrors({ 
                        ...validationErrors, 
                        nepal_id: validateNepalID(e.target.value, newPatient.patient_type) 
                      });
                    }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
      case 2: // ADDRESS
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                select 
                label="Address Type" 
                value={newPatient.address_type} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    address_type: e.target.value 
                  })
                }
              >
                <MenuItem value="home">Home</MenuItem>
                <MenuItem value="refugee camp">Refugee Camp</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Address Line" 
                value={newPatient.address_line} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    address_line: e.target.value 
                  })
                } 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Village / Ward" 
                value={newPatient.village} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    village: e.target.value 
                  })
                } 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Thana / Municipality" 
                value={newPatient.thana} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    thana: e.target.value 
                  })
                } 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Post Code" 
                value={newPatient.post_code} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    post_code: e.target.value 
                  })
                } 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="District" 
                value={newPatient.district} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    district: e.target.value 
                  })
                } 
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Country" 
                value={newPatient.country} 
                onChange={(e) => 
                  setNewPatient({ 
                    ...newPatient, 
                    country: e.target.value 
                  })
                } 
              />
            </Grid>
          </Grid>
        );
      default:
        return null;
    }
  };

  /**
   * FINAL PERSISTENCE LOGIC
   */
  const handleRegisterOrUpdate = async () => {
    if (!selectedClinic || !selectedCountry) {
      notify("Clinic or Country not selected. Please select them from the dashboard.", "error");
      return;
    }

    setLoading(true);
    console.log("Starting registration/update for patient:", currentPatientId);
    
    try {
      const patientData: any = {
        ...newPatient,
        country_id: selectedCountry.id,
        clinic_id: selectedClinic.id,
        photo_url: patientPhotoUrl || null,
        updated_at: serverTimestamp()
      };

      if (!editingPatientId) {
        patientData.created_at = serverTimestamp();
        console.log("Attempting to create patient document:", currentPatientId, patientData);
        await setDoc(
          doc(db, 'patients', currentPatientId), 
          patientData
        );
        console.log("Patient document created successfully.");
        
        const qrToken = `HAEFA-${currentPatientId.slice(0, 8)}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrToken);
        
        console.log("Attempting to create badge token document:", qrToken);
        await setDoc(
          doc(db, 'badge_tokens', qrToken), 
          {
            patient_id: currentPatientId,
            created_at: serverTimestamp(),
            clinic_id: selectedClinic.id,
            country_code: selectedCountry.id
          }
        );
        console.log("Badge token document created successfully.");

        setBadgeData({
          patientId: currentPatientId,
          name: `${newPatient.given_name} ${newPatient.family_name}`,
          qrCode: qrCodeDataUrl,
          photoUrl: patientPhotoUrl,
          clinicName: selectedClinic?.name
        });
        
        setShowBadgeModal(true);
      } else {
        console.log("Attempting to update patient document:", editingPatientId, patientData);
        await updatePatient(
          editingPatientId, 
          patientData
        );
        console.log("Patient document updated successfully.");
      }

      console.log("Attempting to create encounter for patient:", currentPatientId);
      const encounterId = await createEncounter(currentPatientId);
      console.log("Encounter created successfully:", encounterId);
      
      console.log("Attempting to add patient to queue:", currentPatientId);
      await addToQueue({
        patient_id: currentPatientId,
        patient_name: `${newPatient.given_name} ${newPatient.family_name}`,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals'
      });
      console.log("Patient added to queue successfully.");
      
      setSuccessMsg(editingPatientId ? "Profile updated!" : "Registration complete!");
      
      setNewPatient(initialPatientState);
      setPatientPhotoUrl(undefined);
      setEditingPatientId(null);
      setCurrentPatientId(doc(collection(db, 'patients')).id);
      setActiveStep(0);
    } catch (error: any) {
      console.error("Registration/Update Error:", error);
      notify(`Clinical Sync Error: ${error.message}`, "error");
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
        <Typography 
          variant="subtitle1" 
          color="text.secondary"
        >
          Clinical participant intake and identity search
        </Typography>
      </Box>

      {successMsg && (
        <Alert 
          severity="success" 
          sx={{ mb: 3, borderRadius: 3 }}
        >
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={isMobile ? 2 : 3}>
        {/* SEARCH COLUMN */}
        <Grid item xs={12} lg={6}>
          <Card 
            sx={{ 
              borderRadius: 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              boxShadow: 'none', 
              height: '100%' 
            }}
          >
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography 
                variant="h6" 
                fontWeight="800" 
                gutterBottom 
                display="flex" 
                alignItems="center"
              >
                <SearchIcon sx={{ mr: 1, color: 'success.main' }} /> Search Participant
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <QrScannerModal 
                  onScan={async (token) => {
                    const patient = await getPatientByQrToken(token);
                    if (patient) { 
                      setSearchResults([patient]); 
                      setSearchPerformed(true); 
                    } else { 
                      notify("No participant found with this QR.", "error"); 
                    }
                  }} 
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Given Name" 
                    value={searchParams.given_name} 
                    onChange={(e) => 
                      setSearchParams({
                        ...searchParams, 
                        given_name: e.target.value
                      })
                    } 
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Family Name" 
                    value={searchParams.family_name} 
                    onChange={(e) => 
                      setSearchParams({
                        ...searchParams, 
                        family_name: e.target.value
                      })
                    } 
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    color="success" 
                    fullWidth 
                    onClick={handleSearch} 
                    disabled={searching}
                    sx={{ py: 1.5, fontWeight: 900, borderRadius: 2 }}
                  >
                    {searching ? <CircularProgress size={24} /> : "Query System"}
                  </Button>
                </Grid>
              </Grid>

              {searchPerformed && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2 }}>
                    RESULTS ({searchResults.length})
                  </Typography>
                  {searchResults.map((p) => (
                    <Paper 
                      key={p.id} 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        mb: 1.5, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        borderRadius: 2 
                      }}
                    >
                      <Box>
                        <Typography fontWeight="bold">
                          {p.given_name} {p.family_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.gender} • {p.phone || 'No Phone'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton 
                          color="primary" 
                          onClick={() => handleEditPatient(p)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Button 
                          variant="contained" 
                          color="success" 
                          size="small" 
                          onClick={() => 
                            startEncounter(
                              p.id!, 
                              `${p.given_name} ${p.family_name}`
                            )
                          }
                        >
                          Start
                        </Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* REGISTRATION COLUMN */}
        <Grid item xs={12} lg={6}>
          <Card 
            sx={{ 
              borderRadius: 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              boxShadow: 'none' 
            }}
          >
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography 
                variant="h6" 
                fontWeight="800" 
                gutterBottom 
                display="flex" 
                alignItems="center"
              >
                <PersonAddIcon sx={{ mr: 1, color: 'success.main' }} /> 
                {editingPatientId ? 'Update Participant' : 'Register Participant'}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Stepper 
                activeStep={activeStep} 
                orientation="vertical"
              >
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel>
                      <Typography fontWeight="bold">{label}</Typography>
                    </StepLabel>
                    <StepContent>
                      <Box sx={{ mt: 2, mb: 2 }}>
                        {renderStepContent(index)}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          variant="contained" 
                          color="success" 
                          onClick={handleNext} 
                          sx={{ px: 4, borderRadius: 2 }}
                        >
                          {activeStep === steps.length - 1 ? 'Save' : 'Next'}
                        </Button>
                        <Button 
                          disabled={activeStep === 0} 
                          onClick={handleBack}
                        >
                          Back
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* BADGE MODAL (Sacred Template) */}
      <Modal 
        open={showBadgeModal} 
        onClose={() => setShowBadgeModal(false)}
      >
        <Box 
          sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            bgcolor: 'white', 
            p: 4, 
            borderRadius: 4, 
            width: 450, 
            boxShadow: 24 
          }}
        >
          <Typography 
            variant="h5" 
            fontWeight="900" 
            align="center" 
            color="primary" 
            gutterBottom
          >
            Health Identification
          </Typography>
          {badgeData && (
            <Box 
              sx={{ 
                textAlign: 'center', 
                p: 2, 
                border: '1px solid #ddd', 
                borderRadius: 2 
              }}
            >
              <Avatar 
                src={badgeData.photoUrl} 
                sx={{ 
                  width: 120, 
                  height: 120, 
                  mx: 'auto', 
                  mb: 2,
                  border: '3px solid #eee' 
                }} 
              />
              <Typography variant="h6" fontWeight="bold">
                {badgeData.name}
              </Typography>
              <Box 
                component="img" 
                src={badgeData.qrCode} 
                sx={{ 
                  width: 150, 
                  mt: 2 
                }} 
              />
            </Box>
          )}
          <Button 
            fullWidth 
            variant="contained" 
            color="success" 
            sx={{ 
              mt: 3, 
              fontWeight: 900, 
              py: 1.5, 
              borderRadius: 2 
            }} 
            onClick={() => {
              const w = window.open('', '_blank');
              if(w) {
                w.document.write(`
                  <html>
                    <head>
                      <style>
                        body { font-family: sans-serif; display: flex; justify-content: center; padding: 20px; }
                        #badge { width: 400px; border: 2px solid #333; padding: 20px; border-radius: 15px; text-align: center; }
                        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
                        .title { font-size: 18px; font-weight: 800; text-transform: uppercase; }
                        .photo { width: 150px; height: 150px; border-radius: 10px; margin: 10px 0; border: 1px solid #ddd; object-fit: cover; }
                        .qr { width: 140px; margin-top: 10px; }
                      </style>
                    </head>
                    <body>
                      <div id="badge">
                        <div class="header"><div class="title">HAEFA CLINICAL ID</div></div>
                        ${badgeData?.photoUrl ? `<img src="${badgeData.photoUrl}" class="photo" />` : '<div style="height:150px; background:#eee; display:flex; align-items:center; justify-content:center; border-radius:10px; margin:10px 0;">NO PHOTO</div>'}
                        <h3>${badgeData?.name}</h3>
                        <div style="color: #666; font-size: 14px;">${badgeData?.clinicName || ''}</div>
                        <img src="${badgeData?.qrCode}" class="qr" />
                      </div>
                      <script>window.onload = () => { window.print(); window.close(); }</script>
                    </body>
                  </html>
                `);
                w.document.close();
              }
            }}
          >
            Generate Print
          </Button>
        </Box>
      </Modal>
    </StationLayout>
  );
};

export default RegistrationStation;