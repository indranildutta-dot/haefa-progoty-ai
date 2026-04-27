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
  Alert, 
  CircularProgress, 
  MenuItem, 
  Card, 
  CardContent, 
  Divider, 
  Modal, 
  Avatar,
  IconButton, 
  Tooltip, 
  Chip, 
  Stepper, 
  Step, 
  StepLabel, 
  StepContent, 
  Stack, 
  InputAdornment, 
  Switch, 
  FormControlLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PatientPhotoCapture from '../components/PatientPhotoCapture';
import QrScannerModal from '../components/QrScannerModal';
import { 
  searchPatients, 
  updatePatient,
  getPatientById
} from '../services/patientService';
import { 
  createEncounter 
} from '../services/encounterService';
import { 
  addToQueue,
  isPatientInQueue
} from '../services/queueService';
import { 
  Patient,
  TriageLevel
} from '../types';
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
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';
import { 
  getCountryConfig 
} from '../config/useCountry';
import StationLayout from '../components/StationLayout';
import { 
  useResponsiveLayout 
} from '../hooks/useResponsiveLayout';

// =============================================================================
// PATIENT SEARCH RESULT ITEM (Tablet-Optimized)
// =============================================================================
const PatientSearchResultItem: React.FC<{ 
  patient: Patient; 
  onEdit: (p: Patient) => void; 
  onStart: (id: string, name: string, triage?: string) => void;
  onReprint: (p: Patient) => void;
  onCancel: () => void;
}> = ({ patient, onEdit, onStart, onReprint, onCancel }) => {
  const lastVisit = patient.last_visit_date 
    ? patient.last_visit_date.toDate().toLocaleDateString() 
    : 'Never';

  const getTriageColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return '#ef4444'; // Red
      case 'urgent': return '#f59e0b';    // Yellow
      case 'standard': return '#10b981';  // Green
      default: return '#94a3b8';         // Grey
    }
  };

  const triageColor = getTriageColor(patient.triage_level || 'standard');

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        mb: 2, 
        borderRadius: 4, 
        border: '2px solid #f1f5f9',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        bgcolor: 'white',
        '&:hover': { borderColor: 'primary.light', bgcolor: '#f8fafc' }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Avatar 
          src={patient.photo_url} 
          sx={{ 
            width: 70, 
            height: 70, 
            borderRadius: 3, 
            border: '4px solid',
            borderColor: triageColor,
            boxShadow: `0 0 10px ${triageColor}44`,
            bgcolor: 'primary.light',
            fontWeight: 800
          }}
        >
          {patient.given_name[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight="800" noWrap sx={{ fontSize: '1.1rem', color: '#1e293b' }}>
            {patient.given_name} {patient.family_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight="600" sx={{ fontSize: '0.85rem', mt: 0.2 }}>
            {patient.gender?.toUpperCase() || 'N/A'} | ID: {patient.national_id || patient.fcn_number || patient.rohingya_number || patient.nepal_id || patient.id?.slice(0,8).toUpperCase() || 'N/A'}
          </Typography>
          <Typography variant="caption" color="primary" fontWeight="800" sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
            LAST VISIT: {lastVisit}
          </Typography>
        </Box>
        <Tooltip title="Cancel Selection">
          <IconButton onClick={onCancel} size="small" sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
            <Box component="span" sx={{ fontSize: '1.5rem', fontWeight: 900 }}>×</Box>
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={1}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<PrintIcon />}
            onClick={() => onReprint(patient)}
            sx={{ fontWeight: 700, borderRadius: 2, py: 1, fontSize: '0.75rem' }}
          >
            REPRINT
          </Button>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            color="secondary"
            startIcon={<EditIcon />}
            onClick={() => onEdit(patient)}
            sx={{ fontWeight: 700, borderRadius: 2, py: 1, fontSize: '0.75rem' }}
          >
            EDIT
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Button 
            fullWidth
            variant="contained" 
            size="small"
            color="success" 
            startIcon={<PlayArrowIcon />}
            onClick={() => onStart(patient.id!, `${patient.given_name} ${patient.family_name}`, patient.triage_level)}
            sx={{ fontWeight: 900, borderRadius: 2, py: 1, fontSize: '0.75rem' }}
          >
            START VISIT
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

// =============================================================================
// PATIENT ID CARD PRINT COMPONENT (CR90 Size: 3.63" x 2.37")
// =============================================================================
const HealthCardPrint: React.FC<{ badgeData: any }> = ({ badgeData }) => {
  if (!badgeData) return null;
  
  return (
    <Box sx={{ 
      width: '3.63in', 
      height: '2.37in', 
      bgcolor: 'white', 
      color: 'black', 
      p: '15px', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      boxSizing: 'border-box',
      border: '2px solid #004d40',
      borderRadius: '12px',
      overflow: 'hidden',
      fontFamily: '"Inter", sans-serif',
      // Force exact dimensions for printing
      '@media print': {
        width: '3.63in',
        height: '2.37in',
        pageBreakInside: 'avoid',
        m: 0,
        boxShadow: 'none',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }
    }}>
      <Box sx={{ 
        borderBottom: '2.5px solid #004d40', 
        pb: '8px', 
        textAlign: 'center',
        mb: '6px'
      }}>
        <Typography sx={{ fontSize: '10pt', fontWeight: 900, textTransform: 'uppercase', color: '#111', lineHeight: 1.1 }}>
          HEALTH AND EDUCATION FOR ALL, USA
        </Typography>
      </Box>
      
      <Typography sx={{ fontSize: '16pt', fontWeight: 900, color: '#00796b', textAlign: 'center', mb: '6px', letterSpacing: '1px' }}>
        Health Card
      </Typography>
      
      <Stack direction="row" spacing={2} sx={{ flex: 1, alignItems: 'center' }}>
        <Box sx={{ 
          width: '1.2in', 
          height: '1.4in', 
          border: '2.5px solid #004d40', 
          borderRadius: '8px', 
          overflow: 'hidden',
          bgcolor: '#f8fafc'
        }}>
          {badgeData.photoUrl ? (
            <img 
              src={badgeData.photoUrl} 
              alt="Patient" 
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Typography variant="caption" sx={{ fontSize: '8pt', fontWeight: 800 }}>NO PHOTO</Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '10.5pt', fontWeight: 800, color: '#334155', mb: '4px', lineHeight: 1.1 }}>
             {badgeData.clinicName || 'Clinic Name'}
          </Typography>
          <Typography sx={{ fontSize: '15pt', fontWeight: 900, color: '#1e3a8a', mb: '6px', lineHeight: 1.1, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {badgeData.name}
          </Typography>
          <Typography sx={{ fontSize: '9pt', fontWeight: 800, color: '#475569' }}>
            ID: {badgeData.patientId.slice(0, 12).toUpperCase()}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 'auto' }}>
          <Box component="img" src={badgeData.qrCode} sx={{ width: '55pt', height: '55pt', border: '1px solid #e2e8f0', p: '2px', bgcolor: 'white' }} />
          <Typography sx={{ fontSize: '6.5pt', fontWeight: 800, mt: '4px', textTransform: 'uppercase', color: '#64748b' }}>
            VERIFY
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};

// =============================================================================
// REGISTRATION STATION (Sacred UI Architecture v2.2)
// =============================================================================

interface RegistrationStationProps {
  countryId: string;
}

const RegistrationStation: React.FC<RegistrationStationProps> = ({ 
  countryId 
}) => {
  const countryConfig = getCountryConfig(countryId);
  const badgeRef = React.useRef<HTMLDivElement>(null);
  
  const { 
    notify, 
    selectedClinic, 
    selectedCountry, 
    userProfile
  } = useAppStore();
  
  const { isMobile } = useResponsiveLayout();
  
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  
  const [searchParams, setSearchParams] = useState({ 
    given_name: '', 
    family_name: '', 
    phone: '',
    national_id: '',
    rohingya_number: '',
    fcn_number: '',
    bhutanese_refugee_number: '',
    patient_type: '',
    nepal_id: ''
  });

  const [successMsg, setSuccessMsg] = useState('');
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [badgeData, setBadgeData] = useState<{ 
    patientId: string; 
    name: string; 
    qrCode: string; 
    photoUrl?: string; 
    clinicName?: string 
  } | null>(null);

  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | undefined>(undefined);
  const [currentPatientId, setCurrentPatientId] = useState<string>(doc(collection(db, 'patients')).id);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Basic Information', 'Identity & Credentials', 'Address & Contact'];

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
    phone: '',
    marital_status: '' as any,
    national_id: '',
    rohingya_number: '',
    fcn_number: '',
    bhutanese_refugee_number: '',
    nepal_id: '',
    is_fdmn: false,
    camp_name: '',
    block_number: '',
    majhi_name: '',
    tent_number: '',
    address_line: '',
    village: '',
    upazila: '',
    union: '',
    post_code: '',
    district: '',
    country: '',
    father_given_name: '',
    father_family_name: '',
    mother_given_name: '',
    mother_family_name: '',
    permanent_address_same_as_present: true,
    perm_address_line: '',
    perm_village: '',
    perm_district: '',
    perm_upazila: '',
    perm_union: '',
    perm_post_code: '',
    perm_country: '',
    triage_level: 'standard' as TriageLevel
  };

  const [newPatient, setNewPatient] = useState(initialPatientState);
  const [validationErrors, setValidationErrors] = useState({
    national_id: '',
    rohingya_number: '',
    nepal_id: '',
    bhutanese_refugee_number: '',
    date_of_birth: ''
  });

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
    if (d < 1 || d > daysInMonth) return "Invalid day.";
    if (y < 1900 || y > new Date().getFullYear()) return "Invalid year.";
    return '';
  }, []);

  const validateNID = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^(\d{10}|\d{13}|\d{17})$/.test(trimmed) ? '' : "Invalid NID (10, 13, or 17 digits).";
  }, []);

  const validateRohingyaNumber = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const patternA = /^(?=.*-)[a-zA-Z0-9-]{8,15}$/;
    const patternB = /^1\d{16}$/;
    return (patternA.test(trimmed) || patternB.test(trimmed)) ? '' : "Invalid MoHA format.";
  }, []);

  const validateNepalID = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^\d{10}$/.test(trimmed) ? '' : "Invalid Citizen ID (10 digits).";
  }, []);

  const validateBhutaneseRefugeeNumber = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return (/^\d{5,8}$/.test(trimmed) || /^\d{10,12}$/.test(trimmed)) ? '' : "Invalid Refugee ID.";
  }, []);

  const calculateIsMinor = (dob: string, birthYear: string | number) => {
    let age: number | null = null;
    
    if (dob && dob.length === 10) {
      const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      if (regex.test(dob)) {
        const [_, day, month, year] = dob.match(regex)!;
        const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
    } else if (birthYear) {
      age = new Date().getFullYear() - Number(birthYear);
    }

    return age !== null && age < 18;
  };

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
    setNewPatient(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-detect minor status
      if (field === 'date_of_birth' || field === 'estimated_birth_year') {
        updated.is_minor = calculateIsMinor(updated.date_of_birth, updated.estimated_birth_year);
      }
      
      return updated;
    });

    if (field === 'date_of_birth') setValidationErrors(prev => ({ ...prev, date_of_birth: validateDOB(value) }));
    if (selectedCountry?.id === 'BD') {
      if (field === 'national_id') setValidationErrors(prev => ({ ...prev, national_id: validateNID(value) }));
      else if (field === 'fcn_number' || field === 'rohingya_number') setValidationErrors(prev => ({ ...prev, rohingya_number: validateRohingyaNumber(value) }));
    } else if (selectedCountry?.id === 'NP') {
      if (field === 'nepal_id') setValidationErrors(prev => ({ ...prev, nepal_id: validateNepalID(value) }));
      else if (field === 'bhutanese_refugee_number') setValidationErrors(prev => ({ ...prev, bhutanese_refugee_number: validateBhutaneseRefugeeNumber(value) }));
    }
  };

  const handleFieldBlur = (field: string) => {
    const value = (newPatient as any)[field] || '';
    if (field === 'date_of_birth') setValidationErrors(prev => ({ ...prev, date_of_birth: validateDOB(value) }));
    if (selectedCountry?.id === 'BD') {
      if (field === 'national_id') setValidationErrors(prev => ({ ...prev, national_id: validateNID(value) }));
      else if (field === 'fcn_number' || field === 'rohingya_number') setValidationErrors(prev => ({ ...prev, rohingya_number: validateRohingyaNumber(value) }));
    } else if (selectedCountry?.id === 'NP') {
      if (field === 'nepal_id') setValidationErrors(prev => ({ ...prev, nepal_id: validateNepalID(value) }));
      else if (field === 'bhutanese_refugee_number') setValidationErrors(prev => ({ ...prev, bhutanese_refugee_number: validateBhutaneseRefugeeNumber(value) }));
    }
  };

  if (userProfile && !userProfile.isApproved && userProfile.role !== 'global_admin') {
    return (
      <StationLayout title="Registration Station" stationName="Registration" showPatientContext={false}>
        <Box sx={{ p: 8, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Alert severity="warning" sx={{ mb: 4, borderRadius: 4, fontWeight: 900, width: '100%', maxWidth: 600, p: 3, fontSize: '1.2rem' }}>
            ACCOUNT PENDING APPROVAL: Credentials must be verified before registering patients.
          </Alert>
          <Typography variant="h5" sx={{ color: 'text.secondary', fontWeight: 700 }}>Contact System Administrator to activate account.</Typography>
        </Box>
      </StationLayout>
    );
  }

  const handleSearch = async (qrData?: string) => {
    if (!qrData && !searchParams.given_name && !searchParams.family_name && !searchParams.phone && !searchParams.national_id && !searchParams.rohingya_number && !searchParams.fcn_number && !searchParams.nepal_id && !searchParams.bhutanese_refugee_number) {
      notify("Please provide a name or identity number.", "warning");
      return;
    }
    setSearching(true);
    try {
      let results: Patient[] = [];
      if (qrData) {
        const p = await getPatientById(qrData);
        if (p) results = [p];
      } else {
        results = await searchPatients({ ...searchParams });
      }
      setSearchResults(results);
      setSearchPerformed(true);
    } catch (error: any) {
      notify(`Search Failed: ${error.message}`, "error");
    } finally {
      setSearching(false);
    }
  };

  const startEncounter = async (patientId: string, patientName: string, triage: TriageLevel = 'standard') => {
    if (!selectedClinic) return;
    setLoading(true);
    try {
      // Pre-check queue status
      const existingItem = await isPatientInQueue(patientId);
      if (existingItem) {
        const stationName = (existingItem.station || 'another').charAt(0).toUpperCase() + (existingItem.station || 'another').slice(1);
        notify(`Patient Duplicate Entry: This patient is already in the active ${stationName} queue. Please complete or remove the patient from that station before adding them to this queue.`, "error");
        return;
      }

      const encounterId = await createEncounter(patientId);
      await addToQueue({
        patient_id: patientId,
        patient_name: patientName,
        encounter_id: encounterId,
        status: 'WAITING_FOR_VITALS',
        station: 'vitals',
        triage_level: triage
      });
      notify(`Queue position secured for ${patientName}`, "success");
    } catch (error: any) {
      notify(`Queue Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (p: Patient) => {
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
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatientId(patient.id!);
    setCurrentPatientId(patient.id!);
    setPatientPhotoUrl(patient.photo_url);
    setNewPatient({ ...initialPatientState, ...patient } as any);
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!newPatient.given_name.trim() || !newPatient.family_name.trim()) {
        notify("Name is required.", "error");
        return;
      }
      if (!newPatient.date_of_birth.trim() && !newPatient.estimated_birth_year) {
        notify("DOB or Birth Year required.", "error");
        return;
      }
      if (!patientPhotoUrl) {
        notify("Patient photo required.", "error");
        return;
      }
    }
    if (activeStep === 1 && !newPatient.marital_status) {
      notify("Marital status required.", "error");
      return;
    }
    if (Object.values(validationErrors).some(err => err !== '')) {
      notify("Please correct validation errors.", "error");
      return;
    }
    if (activeStep === steps.length - 1) handleRegisterOrUpdate();
    else setActiveStep((prev) => prev + 1);
  };

  const handleRegisterOrUpdate = async () => {
    if (!selectedClinic || !selectedCountry) return;
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

        // Only add to queue if it's a NEW registration
        const encounterId = await createEncounter(currentPatientId);
        await addToQueue({
          patient_id: currentPatientId,
          patient_name: `${newPatient.given_name} ${newPatient.family_name}`,
          encounter_id: encounterId,
          status: 'WAITING_FOR_VITALS',
          station: 'vitals',
          triage_level: newPatient.triage_level
        });
        setSuccessMsg("Success: Record finalized and patient queued.");
      } else {
        await updatePatient(editingPatientId, patientData);
        setSuccessMsg("Success: Patient record updated.");
      }
      
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

  const handlePrint = useReactToPrint({
    contentRef: badgeRef,
    documentTitle: badgeData ? `HealthCard-${badgeData.patientId.slice(0, 8)}` : 'HealthCard',
    onPrintError: (error) => {
      console.error("HAEFA: High-fidelity print failed, falling back to basic print.", error);
      window.print();
    }
  });

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}><Box sx={{ mb: 6, display: 'flex', justifyContent: 'center' }}><PatientPhotoCapture patientId={currentPatientId} onPhotoUploaded={setPatientPhotoUrl} currentPhoto={patientPhotoUrl} isNewPatient={!editingPatientId} /></Box></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Given Name" required value={newPatient.given_name || ''} onChange={(e) => handleFieldChange('given_name', e.target.value)} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} sx={{ bgcolor: 'white' }} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Middle Name" value={newPatient.middle_name || ''} onChange={(e) => handleFieldChange('middle_name', e.target.value)} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} sx={{ bgcolor: 'white' }} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Family Name" required value={newPatient.family_name || ''} onChange={(e) => handleFieldChange('family_name', e.target.value)} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} sx={{ bgcolor: 'white' }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth select label="Gender" required value={newPatient.gender || 'male'} onChange={(e) => handleFieldChange('gender', e.target.value as any)} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} sx={{ bgcolor: 'white' }}><MenuItem value="male">Male</MenuItem><MenuItem value="female">Female</MenuItem><MenuItem value="other">Other</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                select 
                label="Initial Triage" 
                required 
                value={newPatient.triage_level || 'standard'} 
                onChange={(e) => handleFieldChange('triage_level', e.target.value)} 
                InputProps={{ 
                  sx: { 
                    height: 80, 
                    fontSize: '1.5rem', 
                    fontWeight: 700,
                    color: newPatient.triage_level === 'emergency' ? '#ef4444' : newPatient.triage_level === 'urgent' ? '#f59e0b' : '#10b981'
                  } 
                }} 
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                sx={{ bgcolor: 'white' }}
              >
                <MenuItem value="standard" sx={{ color: '#10b981', fontWeight: 700 }}>STANDARD (Green)</MenuItem>
                <MenuItem value="urgent" sx={{ color: '#f59e0b', fontWeight: 700 }}>URGENT (Yellow)</MenuItem>
                <MenuItem value="emergency" sx={{ color: '#ef4444', fontWeight: 700 }}>EMERGENCY (Red)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Date of Birth" placeholder="DD/MM/YYYY" helperText={validationErrors.date_of_birth || "Format: DD/MM/YYYY"} error={!!validationErrors.date_of_birth} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} value={newPatient.date_of_birth || ''} onChange={(e) => handleFieldChange('date_of_birth', e.target.value)} onBlur={() => handleFieldBlur('date_of_birth')} sx={{ bgcolor: 'white' }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Estimated Birth Year" type="number" placeholder="e.g. 1980" InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} value={newPatient.estimated_birth_year || ''} onChange={(e) => handleFieldChange('estimated_birth_year', e.target.value)} sx={{ bgcolor: 'white' }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Country" disabled value={selectedCountry?.name || ''} InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 } }} InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} sx={{ bgcolor: '#f1f5f9' }} /></Grid>
            
            {newPatient.is_minor && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 2 }}>
                    <Chip label="PARENT / GUARDIAN INFORMATION" color="primary" sx={{ fontWeight: 800 }} />
                  </Divider>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Father's First Name" 
                    value={newPatient.father_given_name || ''} 
                    onChange={(e) => handleFieldChange('father_given_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Father's Last Name" 
                    value={newPatient.father_family_name || ''} 
                    onChange={(e) => handleFieldChange('father_family_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Mother's First Name" 
                    value={newPatient.mother_given_name || ''} 
                    onChange={(e) => handleFieldChange('mother_given_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Mother's Last Name" 
                    value={newPatient.mother_family_name || ''} 
                    onChange={(e) => handleFieldChange('mother_family_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
      case 1:
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth 
                label="Primary Contact" 
                value={newPatient.phone || ''} 
                onChange={(e) => handleFieldChange('phone', e.target.value)} 
                InputProps={{ 
                  sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, 
                  startAdornment: (<InputAdornment position="start"><ContactPhoneIcon color="primary" /></InputAdornment>) 
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
                value={newPatient.marital_status || ''} 
                onChange={(e) => handleFieldChange('marital_status', e.target.value)} 
                InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                sx={{ bgcolor: 'white' }}
              >
                <MenuItem value="single">Single</MenuItem>
                <MenuItem value="married">Married</MenuItem>
                <MenuItem value="divorced">Divorced</MenuItem>
                <MenuItem value="widowed">Widowed</MenuItem>
              </TextField>
            </Grid>
            {selectedCountry?.id === 'NP' && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Nepal ID" 
                    value={newPatient.nepal_id || ''} 
                    error={!!validationErrors.nepal_id} 
                    helperText={validationErrors.nepal_id} 
                    onChange={(e) => handleFieldChange('nepal_id', e.target.value)} 
                    onBlur={() => handleFieldBlur('nepal_id')} 
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, 
                      startAdornment: (<InputAdornment position="start"><BadgeIcon color="primary" /></InputAdornment>) 
                    }} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Bhutanese Refugee ID" 
                    value={newPatient.bhutanese_refugee_number || ''} 
                    error={!!validationErrors.bhutanese_refugee_number} 
                    helperText={validationErrors.bhutanese_refugee_number} 
                    onChange={(e) => handleFieldChange('bhutanese_refugee_number', e.target.value)} 
                    onBlur={() => handleFieldBlur('bhutanese_refugee_number')} 
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, 
                      startAdornment: (<InputAdornment position="start"><FingerprintIcon color="primary" /></InputAdornment>) 
                    }} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
      case 2:
        return (
          <Grid container spacing={4}>
            {selectedCountry?.id === 'BD' && (
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: '#f8fafc', border: '2px solid #e2e8f0', mb: 2 }}>
                  <Typography variant="h6" fontWeight="800" gutterBottom color="primary">RESIDENCY STATUS</Typography>
                  <TextField
                    fullWidth
                    select
                    label="Select Residency Status"
                    value={newPatient.is_fdmn ? 'fdmn' : 'national'}
                    onChange={(e) => handleFieldChange('is_fdmn', e.target.value === 'fdmn')}
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}}
                  >
                    <MenuItem value="national">Bangladesh National</MenuItem>
                    <MenuItem value="fdmn">FDMN Camp Member (Rohingya Refugee)</MenuItem>
                  </TextField>
                </Paper>
              </Grid>
            )}

            {selectedCountry?.id === 'BD' && newPatient.is_fdmn ? (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="FDMN Number" 
                    value={newPatient.fcn_number || ''} 
                    error={!!validationErrors.rohingya_number} 
                    helperText={validationErrors.rohingya_number} 
                    onChange={(e) => handleFieldChange('fcn_number', e.target.value)} 
                    onBlur={() => handleFieldBlur('fcn_number')} 
                    InputProps={{ 
                      sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, 
                      startAdornment: (<InputAdornment position="start"><FingerprintIcon color="primary" /></InputAdornment>) 
                    }} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Camp" 
                    required
                    value={newPatient.camp_name || ''} 
                    onChange={(e) => handleFieldChange('camp_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, startAdornment: (<InputAdornment position="start"><HomeIcon color="primary" /></InputAdornment>) }} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Block Number" 
                    placeholder="Ex: A"
                    value={newPatient.block_number || ''} 
                    onChange={(e) => handleFieldChange('block_number', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Majhi / Captain" 
                    value={newPatient.majhi_name || ''} 
                    onChange={(e) => handleFieldChange('majhi_name', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Tent Number" 
                    required
                    placeholder="Ex: 558560"
                    value={newPatient.tent_number || ''} 
                    onChange={(e) => handleFieldChange('tent_number', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
              </>
            ) : (
              <>
                {selectedCountry?.id === 'BD' && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField 
                      fullWidth 
                      label="National ID" 
                      value={newPatient.national_id || ''} 
                      error={!!validationErrors.national_id} 
                      helperText={validationErrors.national_id} 
                      onChange={(e) => handleFieldChange('national_id', e.target.value)} 
                      onBlur={() => handleFieldBlur('national_id')} 
                      InputProps={{ 
                        sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, 
                        startAdornment: (<InputAdornment position="start"><BadgeIcon color="primary" /></InputAdornment>) 
                      }} 
                      InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                      sx={{ bgcolor: 'white' }} 
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Village" 
                    value={newPatient.village || ''} 
                    onChange={(e) => handleFieldChange('village', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }, startAdornment: (<InputAdornment position="start"><HomeIcon color="primary" /></InputAdornment>) }} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="District" 
                    value={newPatient.district || ''} 
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
                    value={newPatient.upazila || ''} 
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
                    value={newPatient.union || ''} 
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
                    placeholder="Ex: 1207"
                    value={newPatient.post_code || ''} 
                    onChange={(e) => handleFieldChange('post_code', e.target.value)} 
                    InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}} 
                    InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                    sx={{ bgcolor: 'white' }} 
                  />
                </Grid>
              </>
            )}
            
            <Grid size={{ xs: 12 }}>
              <TextField 
                fullWidth 
                label="Detailed Address / Landmark" 
                multiline 
                rows={2} 
                value={newPatient.address_line || ''} 
                onChange={(e) => handleFieldChange('address_line', e.target.value)} 
                InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 700, p: 3 }}} 
                InputLabelProps={{ sx: { fontSize: '1.1rem', fontWeight: 600 }}} 
                sx={{ bgcolor: 'white' }} 
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel 
                control={
                  <Switch 
                    checked={newPatient.permanent_address_same_as_present} 
                    onChange={(e) => handleFieldChange('permanent_address_same_as_present', e.target.checked)} 
                    color="primary" 
                  />
                } 
                label={<Typography variant="h6" fontWeight="700">Same as permanent address</Typography>} 
              />
            </Grid>
          </Grid>
        );
      default: return null;
    }
  };

  return (
    <StationLayout title="Registration Station" stationName="Registration" showPatientContext={false}>
      <Box sx={{ mb: 6 }}><Typography variant="h3" fontWeight="900" color="primary" gutterBottom sx={{ letterSpacing: '-0.03em' }}>PARTICIPANT INTAKE</Typography><Typography variant="h6" color="text.secondary" fontWeight="600">{selectedClinic?.name} • {selectedCountry?.name} Clinical Registry</Typography></Box>
      {successMsg && (<Alert severity="success" icon={<CheckCircleIcon fontSize="large" />} sx={{ mb: 6, borderRadius: 4, fontWeight: 800, fontSize: '1.2rem', p: 3 }}>{successMsg}</Alert>)}
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <Box sx={{ bgcolor: 'primary.main', p: 3, color: 'white' }}><Stack direction="row" spacing={2} alignItems="center"><SearchIcon sx={{ fontSize: 32 }} /><Typography variant="h5" fontWeight="900">SYSTEM SEARCH</Typography></Stack></Box>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ mb: 4 }}>
                <Button 
                  fullWidth
                  variant="outlined" 
                  color="primary" 
                  startIcon={<QrCodeScannerIcon />} 
                  onClick={() => setQrOpen(true)}
                  sx={{ height: 60, borderRadius: 3, fontSize: '1.1rem', fontWeight: 800, borderWidth: 2 }}
                >
                  SCAN PATIENT QR
                </Button>
                <QrScannerModal 
                  open={qrOpen} 
                  onClose={() => setQrOpen(false)} 
                  onScan={(data) => {
                    handleSearch(data);
                    setQrOpen(false);
                  }} 
                />
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Given Name" 
                    value={searchParams.given_name || ''} 
                    onChange={(e) => setSearchParams({ ...searchParams, given_name: e.target.value })} 
                    InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Family Name" 
                    value={searchParams.family_name || ''} 
                    onChange={(e) => setSearchParams({ ...searchParams, family_name: e.target.value })} 
                    InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
                  />
                </Grid>

                {selectedCountry?.id === 'BD' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="National ID" 
                        value={searchParams.national_id || ''} 
                        onChange={(e) => setSearchParams({ ...searchParams, national_id: e.target.value })} 
                        InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="FDMN Number" 
                        value={searchParams.fcn_number || searchParams.rohingya_number || ''} 
                        onChange={(e) => setSearchParams({ ...searchParams, fcn_number: e.target.value })} 
                        InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
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
                        value={searchParams.nepal_id || ''} 
                        onChange={(e) => setSearchParams({ ...searchParams, nepal_id: e.target.value })} 
                        InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        fullWidth 
                        label="Bhutanese Refugee ID" 
                        value={searchParams.bhutanese_refugee_number || ''} 
                        onChange={(e) => setSearchParams({ ...searchParams, bhutanese_refugee_number: e.target.value })} 
                        InputProps={{ sx: { height: 60, fontSize: '1.1rem', fontWeight: 700 }}} 
                      />
                    </Grid>
                  </>
                )}

                <Grid size={{ xs: 12 }}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="primary" 
                    onClick={() => handleSearch()} 
                    disabled={searching} 
                    sx={{ 
                      height: { xs: 60, md: 70 }, 
                      fontWeight: 900, 
                      borderRadius: 3, 
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.3rem' }, 
                      boxShadow: 4, 
                      mt: 1 
                    }}
                  >
                    {searching ? <CircularProgress size={28} color="inherit" /> : "EXECUTE QUERY"}
                  </Button>
                </Grid>
              </Grid>
              {searchPerformed && (
                <Box sx={{ mt: 6 }}>
                  <Typography variant="overline" fontWeight="900" color="text.secondary" sx={{ letterSpacing: 2 }}>SEARCH RESULTS ({searchResults.length})</Typography>
                  <Divider sx={{ my: 2 }} />
                  {searchResults.length === 0 ? (<Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No matching records found.</Typography>) : (
                    searchResults.map((p) => (
                      <PatientSearchResultItem 
                        key={p.id} 
                        patient={p} 
                        onEdit={handleEditPatient} 
                        onStart={startEncounter} 
                        onReprint={handleReprint} 
                        onCancel={() => {
                          setSearchResults([]);
                          setSearchPerformed(false);
                          setSearchParams({ 
                            given_name: '', 
                            family_name: '', 
                            phone: '',
                            national_id: '',
                            rohingya_number: '',
                            fcn_number: '',
                            bhutanese_refugee_number: '',
                            patient_type: '',
                            nepal_id: ''
                          });
                        }}
                      />
                    ))
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
            <Box sx={{ bgcolor: editingPatientId ? 'secondary.main' : 'success.main', p: 3, color: 'white' }}><Stack direction="row" spacing={2} alignItems="center"><PersonAddIcon sx={{ fontSize: 32 }} /><Typography variant="h5" fontWeight="900">{editingPatientId ? 'PROFILE SYNCHRONIZATION' : 'NEW PARTICIPANT REGISTRATION'}</Typography></Stack></Box>
            <CardContent sx={{ p: 6 }}>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel><Typography variant="h6" fontWeight="900" color={activeStep === index ? 'primary' : 'text.secondary'}>{label}</Typography></StepLabel>
                    <StepContent>
                      <Box sx={{ py: 6 }}>{renderStepContent(index)}</Box>
                      <Stack direction="row" spacing={3} sx={{ mt: 4 }}>
                        <Button 
                          variant="contained" 
                          color="primary" 
                          onClick={handleNext} 
                          disabled={loading} 
                          sx={{ 
                            height: { xs: 60, sm: 80 }, 
                            px: { xs: 4, sm: 8 }, 
                            fontWeight: 900, 
                            borderRadius: 3, 
                            fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' }, 
                            boxShadow: 4 
                          }}
                        >
                          {loading ? <CircularProgress size={32} color="inherit" /> : (activeStep === steps.length - 1 ? 'FINALIZE RECORD' : 'CONTINUE')}
                        </Button>
                        {editingPatientId && (
                          <Button 
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              setEditingPatientId(null);
                              setNewPatient(initialPatientState);
                              setPatientPhotoUrl(undefined);
                              setCurrentPatientId(doc(collection(db, 'patients')).id);
                              setActiveStep(0);
                              setSuccessMsg('');
                            }}
                            sx={{ 
                              height: { xs: 60, sm: 80 }, 
                              px: 4, 
                              fontWeight: 800, 
                              fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.2rem' },
                              borderWidth: 3,
                              '&:hover': { borderWidth: 3 }
                            }}
                          >
                            CANCEL EDIT
                          </Button>
                        )}
                        <Button 
                          disabled={activeStep === 0 || loading} 
                          onClick={() => setActiveStep(prev => prev - 1)} 
                          sx={{ 
                            height: { xs: 60, sm: 80 }, 
                            px: 4, 
                            fontWeight: 800, 
                            fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.2rem' } 
                          }}
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
      <Modal open={showBadgeModal} onClose={() => setShowBadgeModal(false)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'white', p: 6, borderRadius: 8, width: 550, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          <Typography variant="h4" fontWeight="900" color="primary" gutterBottom sx={{ mb: 4 }}>HEALTH CARD GENERATED</Typography>
          {badgeData && (<Box sx={{ p: 3, border: '2px solid #004d40', borderRadius: 4, bgcolor: 'white', mb: 6, textAlign: 'center', position: 'relative', boxShadow: 3, minHeight: 250, display: 'flex', flexDirection: 'column' }}><Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 1, borderBottom: '2px solid #004d40', pb: 1, textAlign: 'center' }}><Typography variant="h6" fontWeight="900" sx={{ fontSize: '1.1rem', color: '#333', lineHeight: 1.2, textAlign: 'center', width: '100%' }}>HEALTH AND EDUCATION FOR ALL, USA</Typography></Stack><Typography variant="h5" fontWeight="900" sx={{ color: '#00796b', mb: 2, letterSpacing: 1 }}>Health Card</Typography><Stack direction="row" spacing={3} sx={{ flex: 1, alignItems: 'center' }}><Box sx={{ width: 120, height: 150, border: '2px solid #004d40', borderRadius: 2, overflow: 'hidden', bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badgeData.photoUrl ? (<Box component="img" src={badgeData.photoUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<Typography variant="caption" color="text.secondary">NO PHOTO</Typography>)}</Box><Box sx={{ textAlign: 'left', flex: 1 }}><Typography variant="h6" fontWeight="800" sx={{ mb: 0.5, color: '#333', fontSize: '1rem' }}>{badgeData.clinicName}</Typography><Typography variant="h5" fontWeight="900" sx={{ mb: 0.5, fontSize: '1.4rem', color: '#1a237e' }}>{badgeData.name}</Typography><Typography variant="h6" color="text.secondary" fontWeight="800" sx={{ mb: 2, fontSize: '0.9rem' }}>ID: {badgeData.patientId.slice(0, 12).toUpperCase()}</Typography></Box><Box sx={{ textAlign: 'center' }}><Box component="img" src={badgeData.qrCode} sx={{ width: 80, height: 80, p: 0.5, bgcolor: 'white', border: '1px solid #eee' }} /><Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.6rem' }}>SCAN TO VERIFY</Typography></Box></Stack></Box>)}
          <Stack spacing={2}>
            <Button 
              fullWidth 
              variant="contained" 
              color="success" 
              size="large" 
              onClick={handlePrint} 
              sx={{ 
                height: { xs: 60, sm: 80 }, 
                fontWeight: 900, 
                borderRadius: 4, 
                fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' } 
              }}
            >
              PRINT IDENTIFICATION
            </Button>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setShowBadgeModal(false)} 
              sx={{ 
                height: { xs: 50, sm: 60 }, 
                fontWeight: 800, 
                borderRadius: 3,
                fontSize: { xs: '0.9rem', sm: '1rem' }
              }}
            >
              CLOSE
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* Hidden high-fidelity printable badge */}
      <Box sx={{ 
        position: 'fixed',
        top: '-1000px',
        left: '-1000px',
        '@media print': {
           position: 'static',
           display: 'block'
        }
      }}>
        <div ref={badgeRef} id="health-card-print-area">
           <style>{`
             @page {
               size: 3.63in 2.37in;
               margin: 0;
             }
             @media print {
               body { 
                 visibility: hidden; 
                 background: white !important;
                 margin: 0;
                 padding: 0;
               }
               #health-card-print-area, #health-card-print-area * { 
                 visibility: visible; 
               }
               #health-card-print-area { 
                 position: absolute; 
                 left: 0; 
                 top: 0; 
                 width: 3.63in;
                 height: 2.37in;
                 display: block !important;
               }
             }
           `}</style>
           <HealthCardPrint badgeData={badgeData} />
        </div>
      </Box>
    </StationLayout>
  );
};

export default RegistrationStation;
