import React, { 
  useState, 
  useEffect,
  useRef
} from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Chip, 
  Paper, 
  Stack, 
  Divider, 
  CircularProgress,
  Dialog,
  IconButton,
  Tooltip,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Switch,
  Rating,
  Checkbox,
  FormGroup,
  MenuItem,
  Select,
  InputLabel,
  Autocomplete,
  Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import TimerIcon from '@mui/icons-material/Timer';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';

import { auth, functions } from "../firebase";
import { httpsCallable } from 'firebase/functions';
import { 
  subscribeToQueue, 
  updateQueueStatus,
  cancelQueueItem
} from '../services/queueService';
import { 
  saveConsultation, 
  getVitalsByEncounter, 
  getLatestVitals,
  getPatientHistory,
  updateEncounterStatus 
} from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import { calculateAgeYears } from '../utils/patient';
import { calculateCVRisk, calculateCVRiskLab, getRiskLevel, CVRiskInputs, CVRiskLabInputs, Gender } from '../utils/cvRisk';

import StationLayout from '../components/StationLayout';
import StationSearchHeader from '../components/StationSearchHeader';
import PatientContextBar from '../components/PatientContextBar';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import VitalsSnapshot from '../components/VitalsSnapshot';
import CancelQueueDialog from '../components/CancelQueueDialog';
import PrintPrescriptionDialog from '../components/PrintPrescriptionDialog';
import PrescriptionBuilder from '../components/PrescriptionBuilder';

// ICD-11 Library (Types only, scripts are in index.html)
// import * as ECT from '@whoicd/icd11ect'; // Removed to avoid conflict with CDN script

// ==========================================
// TYPES & CONSTANTS
// ==========================================

const sanitizeForFirestore = (obj: any) => {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
};

export type SectionStatus = 'Not Started' | 'In Progress' | 'Complete';

export interface ClinicalAssessmentData {
  complaints: { date: string; description: string; duration: string }[];
  tbScreening: Record<string, string | null>;
  suspectedTBAdditionalSymptoms: Record<string, string | null>;
  suspectedTBExamFindings: Record<string, string | null>;
  suspectedTBPastHistory: {
    year: string | null;
    evidence: string[];
    treatment: string | null;
    duration: string | null;
    result: string | null;
    recovery: string | null;
    others: string | null;
  };
  physicalExamGeneral: {
    anemia: number | null;
    jaundice: number | null;
    edema: number | null;
    lymphNodesPalpable: boolean | null;
    heartNAD: boolean | null;
    lungsNAD: boolean | null;
  };
  physicalExamSystemic: Record<string, string | null>;
  currentRx: {
    name: string;
    isAllergic: boolean;
    frequencyHours: string;
    dose: string;
    doseUnit: string;
    duration: string;
    durationUnit: string;
  }[];
  patientHistory: Record<string, { status: string | null; year?: string | null }>;
  familyHistory: Record<string, { status: string | null; records: { year: string | null; relation: string | null }[] }>;
  vaccination: Record<string, { received: string | null; givenByNirog: boolean | null }>;
  socialHistory: Record<string, string | null>;
  wellbeing: Record<string, string | null>;
  reproductiveHealth: {
    obstetric: {
      gravida: string | null;
      para: string | null;
      stillBirth: string | null;
      miscarriage: string | null;
      mr: string | null;
      liveMaleBirth: string | null;
      liveFemaleBirth: string | null;
      childMortalityMale: string | null;
      childMortalityFemale: string | null;
    };
    menstrual: {
      lmp: string | null;
      contraceptionMethod: string | null;
      comments: string | null;
      menstruationProduct: string | null;
      changeFrequency: string | null;
    };
    cervicalCancer: {
      consent: string | null;
      viaResults: string | null;
      referred: string | null;
      where: string | null;
    };
  };
  cvRisk: {
    age: string | null;
    sex: string | null;
    bmi: string | null;
    isSmoker: string | null;
    sbp: string | null;
    onBPMedication: string | null;
    diabetes: string | null;
    riskScore: number | null;
    overrides: string[];
  };
  cvRiskLab: {
    age: string | null;
    sex: string | null;
    bmi: string | null;
    isSmoker: string | null;
    sbp: string | null;
    onBPMedication: string | null;
    diabetes: string | null;
    totalCholesterol: string | null;
    hdlCholesterol: string | null;
    riskScore: number | null;
    overrides: string[];
  };
  sectionStatuses: Record<string, SectionStatus | null>;
}

export const initialClinicalAssessment: ClinicalAssessmentData = {
  complaints: [],
  tbScreening: {},
  suspectedTBAdditionalSymptoms: {},
  suspectedTBExamFindings: {},
  suspectedTBPastHistory: {
    year: null,
    evidence: [],
    treatment: null,
    duration: null,
    result: null,
    recovery: null,
    others: null
  },
  physicalExamGeneral: {
    anemia: 0,
    jaundice: 0,
    edema: 0,
    lymphNodesPalpable: false,
    heartNAD: false,
    lungsNAD: false,
  },
  physicalExamSystemic: {},
  currentRx: [],
  patientHistory: {},
  familyHistory: {},
  vaccination: {},
  socialHistory: {},
  wellbeing: {
    signsOfMentalIllness: null
  },
  reproductiveHealth: {
    obstetric: {
      gravida: null,
      para: null,
      stillBirth: null,
      miscarriage: null,
      mr: null,
      liveMaleBirth: null,
      liveFemaleBirth: null,
      childMortalityMale: null,
      childMortalityFemale: null,
    },
    menstrual: {
      lmp: null,
      contraceptionMethod: null,
      comments: null,
      menstruationProduct: null,
      changeFrequency: null,
    },
    cervicalCancer: {
      consent: null,
      viaResults: null,
      referred: null,
      where: null,
    },
  },
  cvRisk: {
    age: null,
    sex: null,
    bmi: null,
    isSmoker: null,
    sbp: null,
    onBPMedication: null,
    diabetes: null,
    riskScore: null,
    overrides: []
  },
  cvRiskLab: {
    age: null,
    sex: null,
    bmi: null,
    isSmoker: null,
    sbp: null,
    onBPMedication: null,
    diabetes: null,
    totalCholesterol: null,
    hdlCholesterol: null,
    riskScore: null,
    overrides: []
  },
  sectionStatuses: {
    complaints: 'Not Started',
    tbScreening: 'Not Started',
    suspectedTBAdditionalSymptoms: 'Not Started',
    suspectedTBExamFindings: 'Not Started',
    suspectedTBPastHistory: 'Not Started',
    physicalExamGeneral: 'Not Started',
    physicalExamSystemic: 'Not Started',
    currentRx: 'Not Started',
    patientHistory: 'Not Started',
    familyHistory: 'Not Started',
    vaccination: 'Not Started',
    socialHistory: 'Not Started',
    wellbeing: 'Not Started',
    reproductiveHealth: 'Not Started',
    cvRisk: 'Not Started',
    cvRiskLab: 'Not Started'
  }
};

export interface ConsultationData {
  diagnosis: string;
  notes: string;
  treatment_notes: string;
  prescriptions: any[];
  assessment: ClinicalAssessmentData;
  labInvestigations: string[];
  referrals: string[];
}

const COMMON_SYMPTOMS = ['Fever', 'Cough', 'Headache', 'Diarrhea', 'Vomiting', 'Abdominal pain'];
const COMMON_LABS = ['Complete Blood Count (CBC)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Lipid Profile', 'Urine Routine', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)', 'X-Ray Chest', 'ECG', 'Ultrasound Abdomen'];
const COMMON_REFERRALS = ['Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology', 'Ophthalmology', 'ENT', 'Gynecology'];

// ==========================================
// SUB-COMPONENT: ClinicalAssessmentPanel
// ==========================================

interface AssessmentProps {
  data: ClinicalAssessmentData;
  onChange: (data: ClinicalAssessmentData) => void;
}

const ClinicalAssessmentPanel: React.FC<AssessmentProps> = ({ data, onChange }) => {
  const [expanded, setExpanded] = useState<string | false>(false);
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});

  const { selectedPatient } = useAppStore();
  
  if (!data || !data.sectionStatuses) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>Loading assessment panel...</Typography>
      </Box>
    );
  }

  const patientAge = calculateAgeYears(selectedPatient);
  const isCRAEligible = patientAge >= 40 && patientAge <= 74;
  const isFemaleOver12 = selectedPatient?.gender === 'female' && patientAge >= 12;
  const isChild = patientAge < 18;

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const updateStatus = (section: string, status: SectionStatus) => {
    onChange({
      ...data,
      sectionStatuses: {
        ...data.sectionStatuses,
        [section]: status
      }
    });
  };

  const handleStartSection = (section: string) => {
    if (data.sectionStatuses[section] === 'Not Started') {
      updateStatus(section, 'In Progress');
    }
  };

  const renderCRAField = ({ 
    label, 
    value, 
    field, 
    section, 
    type = 'text', 
    options, 
    placeholder,
    helperText
  }: { 
    label: string, 
    value: string | null, 
    field: string, 
    section: 'cvRisk' | 'cvRiskLab', 
    type?: 'text' | 'select', 
    options?: { label: string, value: string }[],
    placeholder?: string,
    helperText?: string
  }) => {
    const isOverridden = data[section].overrides?.includes(field);
    const hasValue = value !== '' && value !== null && value !== undefined;
    
    // Lock if it has a value AND hasn't been specifically marked for override
    const isLocked = hasValue && !isOverridden;

    return (
      <Grid size={12}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{label}</Typography>
          {hasValue && (
            <Tooltip title={isLocked ? "Override this pre-populated value" : "Restore original value"}>
              <IconButton 
                size="small" 
                onClick={() => {
                  const currentOverrides = data[section].overrides || [];
                  const newOverrides = isLocked 
                    ? [...currentOverrides, field] 
                    : currentOverrides.filter(f => f !== field);
                  onChange({ ...data, [section]: { ...data[section], overrides: newOverrides } });
                }}
                color={isOverridden ? "primary" : "default"}
                sx={{ p: 0.5 }}
              >
                {isOverridden ? <HistoryIcon sx={{ fontSize: 16 }} /> : <EditIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {type === 'text' ? (
          <TextField 
            fullWidth 
            size="small" 
            placeholder={placeholder}
            value={value || ''}
            disabled={isLocked}
            onChange={(e) => {
              handleStartSection(section);
              onChange({ ...data, [section]: { ...data[section], [field]: e.target.value }, sectionStatuses: { ...data.sectionStatuses, [section]: 'Complete' } });
            }}
            helperText={isLocked ? "Pre-populated from previous station" : helperText}
            FormHelperTextProps={{ sx: { fontStyle: 'italic', m: 0, mt: 0.5 } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: isLocked ? '#f1f5f9' : '#fdfdfd' } }}
          />
        ) : (
          <FormControl fullWidth size="small" disabled={isLocked}>
            <Select 
              value={value || ''} 
              displayEmpty
              onChange={(e) => {
                handleStartSection(section);
                onChange({ ...data, [section]: { ...data[section], [field]: e.target.value }, sectionStatuses: { ...data.sectionStatuses, [section]: 'Complete' } });
              }}
              sx={{ borderRadius: 1.5, bgcolor: isLocked ? '#f1f5f9' : '#fdfdfd' }}
            >
              <MenuItem value="" disabled>-- Select --</MenuItem>
              {options?.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
            {isLocked && <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 0.5 }}>Pre-populated from previous station</Typography>}
          </FormControl>
        )}
      </Grid>
    );
  };

  const handleNoToAll = (section: string, fields: string[]) => {
    const updatedSection = { ...(data[section as keyof ClinicalAssessmentData] as any) };
    fields.forEach(f => {
      if (section === 'patientHistory') {
        updatedSection[f] = { status: 'No' };
      } else if (section === 'familyHistory') {
        updatedSection[f] = { status: 'No', records: [] };
      } else {
        updatedSection[f] = 'No';
      }
    });
    
    onChange({
      ...data,
      [section]: updatedSection,
      sectionStatuses: {
        ...data.sectionStatuses,
        [section]: 'Complete'
      }
    });
  };

  const isSuspectedTBActive = () => {
    const { cough, lgerf, nightSweat, weightLoss } = data.tbScreening;
    const countYes = [lgerf, nightSweat, weightLoss].filter(v => v === 'Yes').length;
    return cough === 'Yes' || countYes >= 2;
  };

  const renderAccordionHeader = (id: string, title: string, section: string) => {
    const status = data.sectionStatuses[section] || 'Not Started';
    const isComplete = status === 'Complete';
    const isInProgress = status === 'In Progress';

    return (
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />} 
        sx={{ 
          bgcolor: isComplete ? '#dcfce7' : isInProgress ? '#fef9c3' : 'grey.200',
          borderBottom: '1px solid', 
          borderColor: 'divider',
          '& .MuiAccordionSummary-content': { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
        }}
      >
        <Typography fontWeight="bold" color="text.secondary">{title}</Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: isComplete ? 'success.main' : isInProgress ? 'warning.main' : 'text.secondary', 
            fontWeight: 900,
            textTransform: 'uppercase'
          }}
        >
          {status}
        </Typography>
      </AccordionSummary>
    );
  };

  const handleRadioChange = (section: keyof ClinicalAssessmentData, field: string, value: string) => {
    handleStartSection(section as string);
    if (section === 'patientHistory') {
      onChange({
        ...data,
        patientHistory: {
          ...data.patientHistory,
          [field]: { ...data.patientHistory[field], status: value }
        }
      });
    } else if (section === 'familyHistory') {
      const current = data.familyHistory[field] || { status: '', records: [] };
      const newRecords = value === 'In The Past' && current.records.length === 0 ? [{ year: '', relation: '' }] : current.records;
      onChange({
        ...data,
        familyHistory: {
          ...data.familyHistory,
          [field]: { status: value, records: newRecords }
        }
      });
    } else {
      onChange({
        ...data,
        [section]: {
          ...(data[section] as any),
          [field]: value
        }
      });
    }
  };

  // CRA Auto-calculation
  useEffect(() => {
    if (!isCRAEligible) return;

    // 1. Non-Lab
    const nonLabSBP = parseFloat(data.cvRisk.sbp) || (typeof selectedPatient?.currentVitals?.systolic === 'number' ? selectedPatient.currentVitals.systolic : parseFloat(selectedPatient?.currentVitals?.systolic || ''));
    const nonLabBMI = parseFloat(data.cvRisk.bmi) || (typeof selectedPatient?.currentVitals?.bmi === 'number' ? selectedPatient.currentVitals.bmi : parseFloat(selectedPatient?.currentVitals?.bmi || ''));

    const inputs: CVRiskInputs = {
      age: parseInt(data.cvRisk.age) || patientAge,
      gender: (data.cvRisk.sex === 'Men' || data.cvRisk.sex === 'Women') ? (data.cvRisk.sex as Gender) : (selectedPatient?.gender === 'male' ? 'Men' : 'Women') as Gender,
      isSmoker: data.cvRisk.isSmoker === 'Yes',
      bmi: isNaN(nonLabBMI) ? 0 : nonLabBMI,
      sbp: isNaN(nonLabSBP) ? 0 : nonLabSBP,
      hasDiabetes: data.cvRisk.diabetes === 'Yes',
    };

    // Only calculate if essential fields are present
    const canCalculateNonLab = !isNaN(inputs.age) && inputs.sbp > 0 && inputs.bmi > 0 && data.cvRisk.sex !== '' && data.cvRisk.isSmoker !== '' && data.cvRisk.diabetes !== '';
    const score = canCalculateNonLab ? calculateCVRisk(inputs) : null;
    
    if (score !== data.cvRisk.riskScore) {
      onChange({
        ...data,
        cvRisk: { ...data.cvRisk, riskScore: score }
      });
    }

    // 2. Lab-Based
    const labSBP = parseFloat(data.cvRiskLab.sbp) || (typeof selectedPatient?.currentVitals?.systolic === 'number' ? selectedPatient.currentVitals.systolic : parseFloat(selectedPatient?.currentVitals?.systolic || ''));
    const labChol = parseFloat(data.cvRiskLab.totalCholesterol);

    const labInputs: CVRiskLabInputs = {
      age: parseInt(data.cvRiskLab.age) || patientAge,
      gender: (data.cvRiskLab.sex === 'Men' || data.cvRiskLab.sex === 'Women') ? (data.cvRiskLab.sex as Gender) : (selectedPatient?.gender === 'male' ? 'Men' : 'Women') as Gender,
      isSmoker: data.cvRiskLab.isSmoker === 'Yes',
      sbp: isNaN(labSBP) ? 0 : labSBP,
      hasDiabetes: data.cvRiskLab.diabetes === 'Yes',
      totalCholesterol: isNaN(labChol) ? 0 : labChol,
    };

    // Requirement: All lab fields MUST be present including Cholesterol
    const canCalculateLab = !isNaN(labInputs.age) && labInputs.sbp > 0 && labInputs.totalCholesterol > 0 && data.cvRiskLab.sex !== '' && data.cvRiskLab.isSmoker !== '' && data.cvRiskLab.diabetes !== '';
    const labScore = canCalculateLab ? calculateCVRiskLab(labInputs) : null;

    if (labScore !== data.cvRiskLab.riskScore) {
      onChange({
        ...data,
        cvRiskLab: { ...data.cvRiskLab, riskScore: labScore }
      });
    }
  }, [data.cvRisk, data.cvRiskLab, isCRAEligible, patientAge, selectedPatient]);

  const renderSectionControls = (section: string, fields?: string[]) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="caption" fontWeight="bold">ENABLE EDITING</Typography>
        <Switch 
          size="small"
          checked={editModes[section] || false} 
          onChange={(e) => setEditModes({ ...editModes, [section]: e.target.checked })} 
        />
      </Stack>
      <Stack direction="row" spacing={1}>
        {fields && (
          <Button 
            size="small" 
            variant="outlined" 
            color="primary"
            onClick={() => handleNoToAll(section, fields)}
            sx={{ fontWeight: 800, fontSize: '0.7rem' }}
          >
            NO TO ALL
          </Button>
        )}
        <Button 
          size="small" 
          variant="contained" 
          color="success"
          onClick={() => updateStatus(section, 'Complete')}
          sx={{ fontWeight: 800, fontSize: '0.7rem' }}
        >
          MARK COMPLETE
        </Button>
      </Stack>
    </Box>
  );

  const renderPatientHistoryGroup = (field: string, label: string) => {
    const value = data.patientHistory[field] || { status: '' };
    const section = 'patientHistory';
    
    return (
      <Box key={field} sx={{ mb: 1.5, opacity: editModes[section] ? 1 : 0.6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">{label}</Typography>
          <RadioGroup 
            row 
            value={value.status || ''} 
            onChange={(e) => handleRadioChange(section, field, e.target.value)}
          >
            <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 1 }} />
            <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">Yes</Typography>} sx={{ mr: 1 }} />
            <FormControlLabel value="In The Past" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">In The Past</Typography>} />
          </RadioGroup>
        </Box>
        {value.status === 'In The Past' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={value.year || ''}
                label="Year"
                disabled={!editModes[section]}
                onChange={(e) => {
                  handleStartSection(section);
                  onChange({
                    ...data,
                    patientHistory: {
                      ...data.patientHistory,
                      [field]: { ...value, year: e.target.value as string }
                    }
                  });
                }}
              >
                {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>
    );
  };

  const renderFamilyHistoryGroup = (field: string, label: string) => {
    const value = data.familyHistory[field] || { status: '', records: [] };
    const section = 'familyHistory';
    
    return (
      <Box key={field} sx={{ mb: 2, opacity: editModes[section] ? 1 : 0.6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">{label}</Typography>
          <RadioGroup 
            row 
            value={value.status || ''} 
            onChange={(e) => handleRadioChange(section, field, e.target.value)}
          >
            <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 1 }} />
            <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">Yes</Typography>} sx={{ mr: 1 }} />
            <FormControlLabel value="In The Past" control={<Radio size="small" disabled={!editModes[section]} />} label={<Typography variant="caption">In The Past</Typography>} />
          </RadioGroup>
        </Box>
        {value.status === 'In The Past' && (
          <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid #e2e8f0' }}>
            {value.records.map((record, idx) => (
              <Stack key={idx} direction="row" spacing={1} sx={{ mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={record.year || ''}
                    label="Year"
                    disabled={!editModes[section]}
                    onChange={(e) => {
                      const newRecords = [...value.records];
                      newRecords[idx].year = e.target.value as string;
                      onChange({ ...data, familyHistory: { ...data.familyHistory, [field]: { ...value, records: newRecords } } });
                    }}
                  >
                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(y => <MenuItem key={y} value={y.toString()}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField 
                  size="small" 
                  label="Relation" 
                  value={record.relation || ''} 
                  disabled={!editModes[section]}
                  onChange={(e) => {
                    const newRecords = [...value.records];
                    newRecords[idx].relation = e.target.value;
                    onChange({ ...data, familyHistory: { ...data.familyHistory, [field]: { ...value, records: newRecords } } });
                  }}
                />
                <IconButton 
                  size="small" 
                  color="error" 
                  disabled={!editModes[section]}
                  onClick={() => {
                    const newRecords = value.records.filter((_, i) => i !== idx);
                    onChange({ ...data, familyHistory: { ...data.familyHistory, [field]: { ...value, records: newRecords } } });
                  }}
                >
                  <RemoveCircleIcon />
                </IconButton>
              </Stack>
            ))}
            <Button 
              size="small" 
              startIcon={<AddCircleIcon />} 
              disabled={!editModes[section]}
              onClick={() => {
                const newRecords = [...value.records, { year: '', relation: '' }];
                onChange({ ...data, familyHistory: { ...data.familyHistory, [field]: { ...value, records: newRecords } } });
              }}
            >
              Add Relation
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  const renderYesNoGroup = (section: keyof ClinicalAssessmentData, field: string, label: string) => (
    <Box key={`${section}-${field}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 0.5, opacity: editModes[section as string] ? 1 : 0.6 }}>
      <Typography variant="body2">{label}</Typography>
      <RadioGroup 
        row 
        value={(data[section] as any)[field] || ''} 
        onChange={(e) => handleRadioChange(section, field, e.target.value)}
      >
        <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes[section as string]} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 1 }} />
        <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes[section as string]} />} label={<Typography variant="caption">Yes</Typography>} />
      </RadioGroup>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Complaints */}
      <Accordion expanded={expanded === 'complaints'} onChange={handleChange('complaints')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('complaints', 'Complaints', 'complaints')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('complaints')}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <IconButton 
              color="success" 
              disabled={!editModes['complaints']}
              onClick={() => {
                handleStartSection('complaints');
                onChange({ ...data, complaints: [...data.complaints, { date: new Date().toISOString().split('T')[0], description: '', duration: '' }] });
              }}
            >
              <AddCircleIcon fontSize="large" />
            </IconButton>
          </Box>
          {data.complaints.map((complaint, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f8fafc', p: 1.5, borderRadius: 3, mb: 1 }}>
              <TextField 
                type="date" 
                value={complaint.date || ''} 
                disabled={!editModes['complaints']}
                onChange={(e) => {
                  handleStartSection('complaints');
                  const newComplaints = [...data.complaints];
                  newComplaints[index].date = e.target.value;
                  onChange({ ...data, complaints: newComplaints });
                }} 
              />
              <TextField 
                fullWidth 
                placeholder="Complaint description" 
                value={complaint.description || ''} 
                disabled={!editModes['complaints']}
                onChange={(e) => {
                  handleStartSection('complaints');
                  const newComplaints = [...data.complaints];
                  newComplaints[index].description = e.target.value;
                  onChange({ ...data, complaints: newComplaints });
                }} 
              />
              <TextField 
                placeholder="Duration" 
                value={complaint.duration || ''} 
                disabled={!editModes['complaints']}
                onChange={(e) => {
                  handleStartSection('complaints');
                  const newComplaints = [...data.complaints];
                  newComplaints[index].duration = e.target.value;
                  onChange({ ...data, complaints: newComplaints });
                }} 
              />
              <IconButton 
                color="error" 
                disabled={!editModes['complaints']}
                onClick={() => {
                  handleStartSection('complaints');
                  const newComplaints = data.complaints.filter((_, i) => i !== index);
                  onChange({ ...data, complaints: newComplaints });
                }}
              >
                <RemoveCircleIcon fontSize="large" />
              </IconButton>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* TB Screening */}
      <Accordion expanded={expanded === 'tbScreening'} onChange={handleChange('tbScreening')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('tbScreening', 'TB Screening', 'tbScreening')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('tbScreening', ['cough', 'lgerf', 'nightSweat', 'weightLoss', 'contactHistory'])}
          {renderYesNoGroup('tbScreening', 'cough', 'Cough > 2 Weeks?')}
          {renderYesNoGroup('tbScreening', 'lgerf', 'LGERF?')}
          {renderYesNoGroup('tbScreening', 'nightSweat', 'Night sweat?')}
          {renderYesNoGroup('tbScreening', 'weightLoss', 'Weight loss?')}
          {renderYesNoGroup('tbScreening', 'contactHistory', 'Contact history?')}
        </AccordionDetails>
      </Accordion>

      {/* Suspected TB */}
      {isSuspectedTBActive() && (
        <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
            Additional History for Suspected TB Cases
          </Typography>
          <Accordion expanded={expanded === 'suspectedTBAdditionalSymptoms'} onChange={handleChange('suspectedTBAdditionalSymptoms')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
            {renderAccordionHeader('suspectedTBAdditionalSymptoms', 'Additional Symptoms', 'suspectedTBAdditionalSymptoms')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('suspectedTBAdditionalSymptoms', ['chestPain', 'breathlessness', 'hemoptysis', 'fever', 'fatigue'])}
              {['chestPain', 'breathlessness', 'hemoptysis', 'fever', 'fatigue'].map(f => renderYesNoGroup('suspectedTBAdditionalSymptoms', f, f.charAt(0).toUpperCase() + f.slice(1)))}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Physical Examination - General */}
      <Accordion expanded={expanded === 'physicalExamGeneral'} onChange={handleChange('physicalExamGeneral')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('physicalExamGeneral', 'Physical Examination - General', 'physicalExamGeneral')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('physicalExamGeneral')}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Anemia</Typography>
            <Rating 
              max={3} 
              value={data.physicalExamGeneral.anemia} 
              disabled={!editModes['physicalExamGeneral']}
              onChange={(_, newValue) => {
                handleStartSection('physicalExamGeneral');
                onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, anemia: newValue || 0 } });
              }} 
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Jaundice</Typography>
            <Rating 
              max={3} 
              value={data.physicalExamGeneral.jaundice} 
              disabled={!editModes['physicalExamGeneral']}
              onChange={(_, newValue) => {
                handleStartSection('physicalExamGeneral');
                onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, jaundice: newValue || 0 } });
              }} 
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Edema</Typography>
            <Rating 
              max={3} 
              value={data.physicalExamGeneral.edema} 
              disabled={!editModes['physicalExamGeneral']}
              onChange={(_, newValue) => {
                handleStartSection('physicalExamGeneral');
                onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, edema: newValue || 0 } });
              }} 
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Physical Examination - Systemic */}
      <Accordion expanded={expanded === 'physicalExamSystemic'} onChange={handleChange('physicalExamSystemic')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('physicalExamSystemic', 'Physical Examination - Systemic', 'physicalExamSystemic')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('physicalExamSystemic')}
          <Grid container spacing={2}>
            {['Cardiovascular System', 'Respiratory System', 'Nervous System', 'Abdominal', 'Musculoskeletal'].map((system) => (
              <Grid size={12} key={system}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  label={system}
                  value={data.physicalExamSystemic[system] || ''}
                  disabled={!editModes['physicalExamSystemic']}
                  placeholder={`Enter findings for ${system}...`}
                  onChange={(e) => {
                    handleStartSection('physicalExamSystemic');
                    onChange({
                      ...data,
                      physicalExamSystemic: {
                        ...data.physicalExamSystemic,
                        [system]: e.target.value
                      }
                    });
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Current Rx taken */}
      <Accordion expanded={expanded === 'currentRx'} onChange={handleChange('currentRx')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('currentRx', 'Current Rx taken', 'currentRx')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('currentRx')}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<AddCircleIcon />}
              disabled={!editModes['currentRx']}
              onClick={() => {
                handleStartSection('currentRx');
                onChange({
                  ...data,
                  currentRx: [
                    ...data.currentRx,
                    { name: '', isAllergic: false, frequencyHours: '', dose: '', doseUnit: '', duration: '', durationUnit: '' }
                  ]
                });
              }}
              sx={{ borderRadius: 2, fontWeight: 800 }}
            >
              Add Medication
            </Button>
          </Box>
          {data.currentRx.map((rx, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <TextField 
                fullWidth 
                label="Medicine Name" 
                size="small"
                value={rx.name || ''}
                disabled={!editModes['currentRx']}
                onChange={(e) => {
                  const newRx = [...data.currentRx];
                  newRx[index].name = e.target.value;
                  onChange({ ...data, currentRx: newRx });
                }}
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Dose" value={rx.dose || ''} onChange={(e) => {
                  const newRx = [...data.currentRx];
                  newRx[index].dose = e.target.value;
                  onChange({ ...data, currentRx: newRx });
                }} />
                <IconButton color="error" onClick={() => {
                  const newRx = data.currentRx.filter((_, i) => i !== index);
                  onChange({ ...data, currentRx: newRx });
                }}><RemoveCircleIcon /></IconButton>
              </Stack>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient H/O illness */}
      <Accordion expanded={expanded === 'patientHistory'} onChange={handleChange('patientHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('patientHistory', 'Patient H/O illness', 'patientHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('patientHistory', ['HTN', 'DM', 'Asthma', 'COPD', 'Stroke', 'IHD', 'CKD'])}
          {['HTN', 'DM', 'Asthma', 'COPD', 'Stroke', 'IHD', 'CKD'].map((illness) => (
            renderPatientHistoryGroup(illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Family H/O illness */}
      <Accordion expanded={expanded === 'familyHistory'} onChange={handleChange('familyHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('familyHistory', 'Family H/O illness', 'familyHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('familyHistory', ['HTN', 'DM', 'Asthma', 'COPD', 'Stroke', 'IHD', 'CKD'])}
          {['HTN', 'DM', 'Asthma', 'COPD', 'Stroke', 'IHD', 'CKD'].map((illness) => (
            renderFamilyHistoryGroup(illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Social History */}
      <Accordion expanded={expanded === 'socialHistory'} onChange={handleChange('socialHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('socialHistory', 'Social History', 'socialHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('socialHistory', ['Smoking', 'Alcohol', 'Drugs'])}
          {['Smoking', 'Alcohol', 'Drugs'].map(f => renderYesNoGroup('socialHistory', f, f))}
        </AccordionDetails>
      </Accordion>

      {/* Wellbeing */}
      <Accordion expanded={expanded === 'wellbeing'} onChange={handleChange('wellbeing')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('wellbeing', 'Wellbeing', 'wellbeing')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('wellbeing', ['signsOfMentalIllness'])}
          {renderYesNoGroup('wellbeing', 'signsOfMentalIllness', 'Any signs of mental illness?')}
        </AccordionDetails>
      </Accordion>

      {/* Reproductive Health */}
      {isFemaleOver12 && (
        <Accordion expanded={expanded === 'reproductiveHealth'} onChange={handleChange('reproductiveHealth')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          {renderAccordionHeader('reproductiveHealth', 'Reproductive Health', 'reproductiveHealth')}
          <AccordionDetails sx={{ bgcolor: 'white' }}>
            {renderSectionControls('reproductiveHealth')}
            <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>Obstetric History</Typography>
            <Grid container spacing={2}>
              <Grid size={4}><TextField fullWidth size="small" label="Gravida" value={data.reproductiveHealth.obstetric.gravida || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, gravida: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Para" value={data.reproductiveHealth.obstetric.para || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, para: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Still Birth" value={data.reproductiveHealth.obstetric.stillBirth || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, stillBirth: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Miscarriage" value={data.reproductiveHealth.obstetric.miscarriage || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, miscarriage: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="MR" value={data.reproductiveHealth.obstetric.mr || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, mr: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Live Birth (M)" value={data.reproductiveHealth.obstetric.liveMaleBirth || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, liveMaleBirth: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Live Birth (F)" value={data.reproductiveHealth.obstetric.liveFemaleBirth || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, liveFemaleBirth: e.target.value } } });
              }} /></Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, fontWeight: 'bold' }}>Menstrual History</Typography>
            <Grid container spacing={2}>
              <Grid size={6}><TextField fullWidth type="date" size="small" label="LMP" InputLabelProps={{ shrink: true }} value={data.reproductiveHealth.menstrual.lmp || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, menstrual: { ...data.reproductiveHealth.menstrual, lmp: e.target.value } } });
              }} /></Grid>
              <Grid size={6}><TextField fullWidth size="small" label="Contraception Method" value={data.reproductiveHealth.menstrual.contraceptionMethod || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, menstrual: { ...data.reproductiveHealth.menstrual, contraceptionMethod: e.target.value } } });
              }} /></Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, fontWeight: 'bold' }}>Cervical Cancer Screening (VIA)</Typography>
            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>VIA Results</InputLabel>
                  <Select value={data.reproductiveHealth.cervicalCancer.viaResults || ''} label="VIA Results" onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, viaResults: e.target.value } } });
                  }}>
                    <MenuItem value="Negative">Negative</MenuItem>
                    <MenuItem value="Positive">Positive</MenuItem>
                    <MenuItem value="Suspicious">Suspicious</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}><TextField fullWidth size="small" label="Referred To" value={data.reproductiveHealth.cervicalCancer.where || ''} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, where: e.target.value } } });
              }} /></Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* CV Risk Assessment */}
      {isCRAEligible && (
        <>
          <Accordion expanded={expanded === 'cvRisk'} onChange={handleChange('cvRisk')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            {renderAccordionHeader('cvRisk', 'CV Risk Assessment (Non-Lab)', 'cvRisk')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('cvRisk')}
              
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>CRA (NON-LAB)</Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={2.5}>
                  {renderCRAField({
                    label: "Age",
                    field: "age",
                    section: "cvRisk",
                    value: data.cvRisk.age,
                    placeholder: "Between : 40-74"
                  })}

                  {renderCRAField({
                    label: "Sex",
                    field: "sex",
                    section: "cvRisk",
                    value: data.cvRisk.sex,
                    type: "select",
                    options: [{ label: "Men", value: "Men" }, { label: "Women", value: "Women" }]
                  })}

                  {renderCRAField({
                    label: "BMI",
                    field: "bmi",
                    section: "cvRisk",
                    value: data.cvRisk.bmi,
                    placeholder: "-- Enter BMI --"
                  })}

                  {renderCRAField({
                    label: "Cigarette Smoker",
                    field: "isSmoker",
                    section: "cvRisk",
                    value: data.cvRisk.isSmoker,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {renderCRAField({
                    label: "Systolic Blood Pressure",
                    field: "sbp",
                    section: "cvRisk",
                    value: data.cvRisk.sbp,
                    placeholder: "mmHg"
                  })}

                  {renderCRAField({
                    label: "On Blood Pressure Medication",
                    field: "onBPMedication",
                    section: "cvRisk",
                    value: data.cvRisk.onBPMedication,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {renderCRAField({
                    label: "Diabetes",
                    field: "diabetes",
                    section: "cvRisk",
                    value: data.cvRisk.diabetes,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {data.cvRisk.riskScore !== null && (
                    <Grid size={12}>
                      <Box sx={{ 
                        mt: 3, 
                        p: 2.5, 
                        bgcolor: 'white', 
                        borderRadius: 3, 
                        border: '3px solid', 
                        borderColor: getRiskLevel(data.cvRisk.riskScore).color,
                        boxShadow: `0 8px 16px -4px ${getRiskLevel(data.cvRisk.riskScore).color}25`,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 800, mb: 1 }}>
                          WHO 10-Year Risk Score
                        </Typography>
                        <Typography variant="h3" sx={{ color: getRiskLevel(data.cvRisk.riskScore).color, fontWeight: 950, my: 1 }}>
                          {data.cvRisk.riskScore}%
                        </Typography>
                        <Box sx={{ 
                          display: 'inline-block',
                          px: 2, 
                          py: 0.5, 
                          borderRadius: 1, 
                          bgcolor: getRiskLevel(data.cvRisk.riskScore).color,
                          color: data.cvRisk.riskScore < 20 ? '#1e293b' : 'white' // Dark text for light backgrounds
                        }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                            {getRiskLevel(data.cvRisk.riskScore).label}
                          </Typography>
                        </Box>
                      </Box>
                      {data.cvRisk.onBPMedication === 'Yes' && (
                        <Alert severity="warning" sx={{ mt: 2, border: '1px solid #ed6c02', borderRadius: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            Clinical Warning: Risk value may be underestimated due to current antihypertensive therapy (On BP Medication).
                          </Typography>
                        </Alert>
                      )}
                    </Grid>
                  )}
                </Grid>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={expanded === 'cvRiskLab'} onChange={handleChange('cvRiskLab')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            {renderAccordionHeader('cvRiskLab', 'CV Risk Assessment (Lab-Based)', 'cvRiskLab')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('cvRiskLab')}
              
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>CRA (LAB BASED)</Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={2.5}>
                  {renderCRAField({
                    label: "Age",
                    field: "age",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.age,
                    placeholder: "Between : 40-74"
                  })}

                  {renderCRAField({
                    label: "Sex",
                    field: "sex",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.sex,
                    type: "select",
                    options: [{ label: "Men", value: "Men" }, { label: "Women", value: "Women" }]
                  })}

                  {renderCRAField({
                    label: "BMI",
                    field: "bmi",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.bmi,
                    placeholder: "-- Enter BMI --"
                  })}

                  {renderCRAField({
                    label: "Cigarette Smoker",
                    field: "isSmoker",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.isSmoker,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {renderCRAField({
                    label: "Systolic Blood Pressure",
                    field: "sbp",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.sbp,
                    placeholder: "mmHg"
                  })}

                  {renderCRAField({
                    label: "On Blood Pressure Medication",
                    field: "onBPMedication",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.onBPMedication,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {renderCRAField({
                    label: "Diabetes",
                    field: "diabetes",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.diabetes,
                    type: "select",
                    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]
                  })}

                  {renderCRAField({
                    label: "Total Cholesterol In Mg/Dl",
                    field: "totalCholesterol",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.totalCholesterol,
                    placeholder: "EX: 180"
                  })}

                  {renderCRAField({
                    label: "HDL Cholesterol In Mg/Dl",
                    field: "hdlCholesterol",
                    section: "cvRiskLab",
                    value: data.cvRiskLab.hdlCholesterol,
                    placeholder: "EX: 50"
                  })}

                  <Grid size={12}>
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight="900" sx={{ mb: 1 }}>Result</Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Important: Inputs must be complete to perform calculation
                      </Typography>
                      
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        mt: 2,
                        p: 3,
                        borderRadius: 4,
                        bgcolor: 'white',
                        border: '3px dashed',
                        borderColor: data.cvRiskLab.riskScore !== null ? getRiskLevel(data.cvRiskLab.riskScore).color : '#e2e8f0',
                        boxShadow: data.cvRiskLab.riskScore !== null ? `0 10px 15px -3px ${getRiskLevel(data.cvRiskLab.riskScore).color}20` : 'none'
                      }}>
                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#475569', mb: 2 }}>10-Year Cardiovascular Risk</Typography>
                        <Box sx={{ 
                          width: 160, 
                          height: 70, 
                          bgcolor: data.cvRiskLab.riskScore !== null ? `${getRiskLevel(data.cvRiskLab.riskScore).color}10` : '#f1f5f9', 
                          border: '2px solid',
                          borderColor: data.cvRiskLab.riskScore !== null ? getRiskLevel(data.cvRiskLab.riskScore).color : '#cbd5e1', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          borderRadius: 3
                        }}>
                          <Typography variant="h3" fontWeight="950" color={data.cvRiskLab.riskScore !== null ? getRiskLevel(data.cvRiskLab.riskScore).color : 'text.disabled'}>
                            {data.cvRiskLab.riskScore !== null ? data.cvRiskLab.riskScore : '--'}
                          </Typography>
                          <Typography variant="h5" fontWeight="900" sx={{ ml: 1, color: '#64748b' }}>%</Typography>
                        </Box>
                      </Box>
                      
                      {data.cvRiskLab.riskScore !== null && (
                        <>
                         <Box sx={{ 
                           mt: 2, 
                           display: 'inline-block', 
                           px: 3, 
                           py: 1, 
                           borderRadius: 2, 
                           bgcolor: getRiskLevel(data.cvRiskLab.riskScore).color,
                           color: data.cvRiskLab.riskScore < 20 ? '#1e293b' : 'white'
                         }}>
                           <Typography variant="h6" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                             {getRiskLevel(data.cvRiskLab.riskScore).label}
                           </Typography>
                         </Box>
                         {data.cvRiskLab.onBPMedication === 'Yes' && (
                           <Alert severity="warning" sx={{ mt: 3, border: '1px solid #ed6c02', borderRadius: 2, textAlign: 'left' }}>
                             <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                               Clinical Warning: Risk value may be underestimated due to current antihypertensive therapy (On BP Medication).
                             </Typography>
                           </Alert>
                         )}
                        </>
                      )}
                    </Box>
                  </Grid>

                  {/* History Tracking Note */}
                  {((data.cvRiskLab.overrides || []).length > 0 || (data.cvRisk.overrides || []).length > 0) && (
                    <Grid size={12}>
                      <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                          Clinical Note: The following fields were manually overridden by the doctor: {[...(data.cvRisk.overrides || []), ...(data.cvRiskLab.overrides || [])].join(', ')}. Original vitals are preserved in history.
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </Box>
  );
};

// ==========================================
// MAIN COMPONENT: DoctorStation
// ==========================================

interface DoctorStationProps {
  countryId: string;
}

const DoctorStation: React.FC<DoctorStationProps> = ({ countryId }) => {
  const { 
    notify, 
    selectedClinic, 
    selectedPatient,
    setSelectedPatient,
    userProfile
  } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [currentVitals, setCurrentVitals] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [highlightedPatientIds, setHighlightedPatientIds] = useState<string[]>([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [lastEncounterId, setLastEncounterId] = useState<string | null>(null);

  const handleReprint = async (patientId: string) => {
    try {
      const history = await getPatientHistory(patientId);
      for (const enc of history) {
        if (enc.status === 'COMPLETED' || enc.status === 'WAITING_FOR_PHARMACY' || enc.encounter_status === 'COMPLETED' || enc.encounter_status === 'WAITING_FOR_PHARMACY') {
           setLastEncounterId(enc.id);
           setShowPrintDialog(true);
           return;
        }
      }
      notify("No past prescription found to reprint.", "warning");
    } catch (e) {
      console.error(e);
      notify("Failed to fetch prescription history.", "error");
    }
  };
  
  const [consultData, setConsultData] = useState<ConsultationData>({ 
    diagnosis: '', 
    notes: '', 
    treatment_notes: '', 
    prescriptions: [], 
    assessment: initialClinicalAssessment,
    labInvestigations: [],
    referrals: []
  });

  const icdInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // ICD-11 INTEGRATION (CDN SCRIPT SYNC)
  // ==========================================
  useEffect(() => {
    const initECT = () => {
      // Check if (window.ECT) to ensure the library is loaded from CDN
      if (typeof (window as any).ECT === 'undefined') {
        console.log("WHO ECT library not loaded yet, retrying...");
        setTimeout(initECT, 500);
        return;
      }

      console.log("Initializing ICD-11 ECT Handler via Local Assets...");
      const ECT_LIB = (window as any).ECT;
      
      const settings = {
        apiServerUrl: "https://id.who.int",
        apiLinearization: "mms",
        getNewTokenFunction: async () => {
          try {
            console.table({ event: 'ICD_TOKEN_REQUEST', timestamp: new Date().toISOString() });
            console.log('HAEFA: Library is requesting a new token...');
            console.log("Fetching ICD token from backend Function...");
            const getIcdToken = httpsCallable(functions, 'getIcdToken');
            const result: any = await getIcdToken();
            
            // WHO library strictly requires the string inside .data
            console.log('DEBUG: Backend Token Response:', result);
            console.log('HAEFA: Unwrapped Token:', result.data);
            return result.data; 
          } catch (error) {
            console.error("Critical Token Error:", error);
            return "";
          }
        }
      };

      const callbacks = {
        selectedEntityFunction: (selectedEntity: any) => {
          console.log("ICD Entity Selected:", selectedEntity);
          const diagnosisText = `${selectedEntity.code} - ${selectedEntity.bestMatchText}`;
          
          // Update the Ref directly (Uncontrolled)
          if (icdInputRef.current) {
            icdInputRef.current.value = diagnosisText;
          }
          
          // Update the State for persistence
          setConsultData(prev => ({
            ...prev,
            diagnosis: diagnosisText
          }));
          
          ECT_LIB.Handler.clear("1");
        }
      };

      // Configure the ECT Handler
      ECT_LIB.Handler.configure(settings, callbacks);
      
      // CRITICAL: Manual initialization to ensure server URL is explicitly set before binding
      console.log("HAEFA: Setting explicit apiServerUrl and binding...");
      ECT_LIB.Handler.configure({ apiServerUrl: "https://id.who.int" });
      
      // CRITICAL: Manually connect the search tool to the input field with delay
      setTimeout(() => {
        console.log("Binding ICD-11 search tool to input field...");
        ECT_LIB.Handler.bind("1");
        console.log('HAEFA: ICD-11 Engine Bound');
      }, 500);
    };

    if (selectedItem) {
      // Delay initialization slightly to ensure DOM is ready
      const timer = setTimeout(initECT, 500);
      return () => clearTimeout(timer);
    }

    return () => {
      if (typeof (window as any).ECT !== 'undefined') {
        (window as any).ECT.Handler.clear("1");
      }
    };
  }, [selectedItem]);

  // ==========================================
  // QUEUE & DATA LOGIC
  // ==========================================
  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue(
      ['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, 
      setWaitingList, 
      (err) => console.error("Doctor Queue Error:", err)
    );
    return () => unsubscribe();
  }, [selectedClinic]);

  const handleOpenConsult = async (item: any) => {
    try {
      setSelectedItem(item);
      const patient = await getPatientById(item.patient_id);
      let vitals = await getVitalsByEncounter(item.encounter_id);
      
      // If patient skipped vitals (Add to Queue directly), fetch last visit's vitals
      if (!vitals) {
        vitals = await getLatestVitals(item.patient_id);
      }
      
      setCurrentVitals(vitals);
      setSelectedPatient({ ...patient, currentVitals: vitals, triage_level: item.triage_level });
      await updateQueueStatus(item.id, 'IN_CONSULTATION' as any);
      
      const patientAge = calculateAgeYears(patient);
      
      // Pre-fill CRA data from previous stations
      const preFilledAssessment = {
        ...initialClinicalAssessment,
        cvRisk: {
          ...initialClinicalAssessment.cvRisk,
          age: patientAge.toString(),
          sex: patient?.gender === 'male' ? 'Men' : 'Women',
          bmi: vitals?.bmi?.toString() || '',
          sbp: vitals?.systolic?.toString() || '',
          isSmoker: vitals?.social_history?.smoking === true ? 'Yes' : (vitals?.social_history?.smoking === false ? 'No' : ''),
          diabetes: (vitals?.rbg >= 200 || vitals?.fbg >= 126) ? 'Yes' : (vitals?.rbg || vitals?.fbg ? 'No' : ''),
          overrides: [],
        },
        cvRiskLab: {
          ...initialClinicalAssessment.cvRiskLab,
          age: patientAge.toString(),
          sex: patient?.gender === 'male' ? 'Men' : 'Women',
          bmi: vitals?.bmi?.toString() || '',
          sbp: vitals?.systolic?.toString() || '',
          isSmoker: vitals?.social_history?.smoking === true ? 'Yes' : (vitals?.social_history?.smoking === false ? 'No' : ''),
          diabetes: (vitals?.rbg >= 200 || vitals?.fbg >= 126) ? 'Yes' : (vitals?.rbg || vitals?.fbg ? 'No' : ''),
          totalCholesterol: vitals?.total_cholesterol?.toString() || '',
          hdlCholesterol: vitals?.hdl_cholesterol?.toString() || '',
          overrides: [],
        }
      };

      setConsultData({
        diagnosis: '', 
        notes: '', 
        treatment_notes: '', 
        prescriptions: [], 
        assessment: preFilledAssessment,
        labInvestigations: [],
        referrals: []
      });
    } catch (e) { 
      notify("Error loading patient context.", "error"); 
      console.error(e);
    }
  };

  const handleSave = async (options: { isProgress?: boolean; isComplete?: boolean; isFinalize?: boolean } = {}) => {
    if (!selectedItem) return;
    
    console.group('HAEFA SAVE DIAGNOSTICS');
    
    const payload = { 
      ...consultData, 
      encounter_id: selectedItem.encounter_id, 
      patient_id: selectedItem.patient_id
    };

    const prescriptionPayload = {
      encounter_id: selectedItem.encounter_id,
      patient_id: selectedItem.patient_id,
      prescriptions: (consultData.prescriptions || []).map((p: any) => ({
        ...p,
        status: 'Pending',
        dispensedQuantity: 0,
        remainingQuantity: p.quantity || 0
      }))
    };

    // The Permanent Shield: Global Sanitizer
    const cleanPayload = sanitizeForFirestore(payload);
    const finalPrescriptionData = sanitizeForFirestore(prescriptionPayload);

    console.groupEnd();

    try {
      setIsFinalizing(true);
      await saveConsultation(cleanPayload, finalPrescriptionData);
      
      if (options.isFinalize) {
        await updateQueueStatus(selectedItem.id, 'WAITING_FOR_PHARMACY' as any);
        setLastEncounterId(selectedItem.encounter_id);
        setShowPrintDialog(true);
        setSelectedItem(null);
        setSelectedPatient(null);
        notify("Consultation finalized.", "success");
      } else if (options.isComplete) {
        notify("Diagnosis marked as complete.", "success");
      } else {
        notify("Progress saved locally.", "info");
        setSelectedItem(null);
        setSelectedPatient(null);
      }
    } catch (e: any) {
      console.error('HAEFA SAVE ERROR:', e);
      notify(`Failed to save: ${e.message}`, "error");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalize = async (status: string) => {
    if (!consultData.diagnosis) {
      notify("A primary diagnosis is required.", "warning");
      return;
    }
    await handleSave({ isFinalize: true });
  };

  const isCRAEligible = calculateAgeYears(selectedPatient) >= 40 && calculateAgeYears(selectedPatient) <= 74;
  const isFemaleOver12 = selectedPatient?.gender === 'female' && calculateAgeYears(selectedPatient) >= 12;

  const isSuspectedTBActive = () => {
    if (!consultData.assessment?.tbScreening) return false;
    const { cough, lgerf, nightSweat, weightLoss } = consultData.assessment.tbScreening;
    const countYes = [lgerf, nightSweat, weightLoss].filter(v => v === 'Yes').length;
    return cough === 'Yes' || countYes >= 2;
  };

  const areAllSectionsComplete = () => {
    if (!consultData.assessment?.sectionStatuses) return false;
    const statuses = consultData.assessment.sectionStatuses;
    const activeSections = [
      'complaints',
      'tbScreening',
      'physicalExamGeneral',
      'physicalExamSystemic',
      'currentRx',
      'patientHistory',
      'familyHistory',
      'socialHistory',
      'wellbeing'
    ];
    
    if (isSuspectedTBActive()) {
      activeSections.push('suspectedTBAdditionalSymptoms');
    }
    
    if (isFemaleOver12) {
      activeSections.push('reproductiveHealth');
    }
    
    if (isCRAEligible) {
      activeSections.push('cvRisk');
      activeSections.push('cvRiskLab');
    }
    
    return activeSections.every(section => statuses[section] === 'Complete');
  };

  // ==========================================
  // RENDER LOGIC
  // ==========================================
  return (
    <StationLayout 
      title="Doctor Station" 
      stationName="Doctor" 
      showPatientContext={!!selectedItem}
      hideSidebar={!!selectedItem}
      maxWidth={selectedItem ? false : "xl"}
    >
      {!selectedItem ? (
        <Box>
          <StationSearchHeader 
            stationStatus="READY_FOR_DOCTOR"
            onPatientFound={(p, item) => item ? handleOpenConsult(item) : null}
            waitingList={waitingList}
            highlightedPatientIds={highlightedPatientIds}
            setHighlightedPatientIds={setHighlightedPatientIds}
            onReprint={handleReprint}
          />

          <TableContainer component={Paper} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Wait Time</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Triage</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {waitingList.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> 
                        <Typography variant="body2">
                          {Math.floor((Date.now() - (item.created_at?.toDate().getTime() || Date.now())) / 60000)}m
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.triage_level?.toUpperCase()} 
                        size="small" 
                        sx={{ 
                          fontWeight: 900,
                          bgcolor: item.triage_level === 'emergency' ? '#ef4444' : 
                                   item.triage_level === 'urgent' ? '#f59e0b' : 
                                   item.triage_level === 'standard' ? '#10b981' : '#64748b',
                          color: 'white'
                        }} 
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button variant="contained" onClick={() => handleOpenConsult(item)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                          Start Consultation
                        </Button>
                        <Tooltip title="Remove patient from queue">
                          <IconButton onClick={() => setCancelTarget(item)} color="error" size="small" sx={{ bgcolor: '#fee2e2', '&:hover': { bgcolor: '#fecaca' } }}>
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ mt: -3, pb: 12 }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* LEFT: Vitals */}
            <Grid size={{ xs: 12, md: 2.5 }} sx={{ position: 'sticky', top: 80, alignSelf: 'flex-start', maxHeight: '80vh', overflowY: 'auto' }}>
              <VitalsSnapshot vitals={currentVitals} />
            </Grid>

            {/* MIDDLE: Assessment & Diagnosis */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                <Typography variant="h6" fontWeight="900" gutterBottom color="primary">CLINICAL ASSESSMENT</Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Section 1: Assessment */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 1 — Required Clinical Assessment</Typography>
                    <ClinicalAssessmentPanel 
                      data={consultData.assessment} 
                      onChange={(val) => setConsultData(prev => ({ ...prev, assessment: val }))} 
                    />
                  </Box>

                  <Divider />

                  {/* Section 2: Notes */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 2 — Optional Additional Notes</Typography>
                    <TextField 
                      fullWidth multiline rows={3} variant="outlined" 
                      value={consultData.notes || ''} 
                      onChange={(e) => setConsultData(prev => ({ ...prev, notes: e.target.value }))} 
                      placeholder="Enter optional additional notes..." 
                    />
                  </Box>

                  <Divider />

                  {/* Section 3: Diagnosis (ICD-11 UNCONTROLLED) */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>
                      Section 3 — Provisional Diagnosis (ICD-11)
                    </Typography>
                    <Box sx={{ position: 'relative' }}>
                      <TextField 
                        fullWidth
                        inputRef={icdInputRef}
                        inputProps={{ 
                          "id": "icd11-input",
                          "data-ctw-ino": "1",
                          autoComplete: "off"
                        }}
                        onChange={(e) => setConsultData(prev => ({ ...prev, diagnosis: e.target.value }))}
                        placeholder="Search ICD-11 Diagnosis..." 
                        variant="outlined"
                        sx={{ 
                          bgcolor: 'white',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2
                          }
                        }}
                      />
                      {/* WHO ECT Search Results Window */}
                      <Box 
                        className="ctw-window" 
                        data-ctw-ino="1" 
                        sx={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          zIndex: 9999,
                          bgcolor: 'white',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          borderRadius: '0 0 8px 8px',
                          border: '1px solid #e2e8f0',
                          borderTop: 'none',
                          maxHeight: '400px',
                          overflowY: 'auto'
                        }}
                      />
                    </Box>
                  </Box>

                  <Divider />

                  {/* Section 4: Prescription */}
                  <PrescriptionBuilder 
                    initialData={consultData.prescriptions} 
                    onPrescriptionChange={(prescriptions) => setConsultData(prev => ({ ...prev, prescriptions }))} 
                  />

                  <Divider />

                  {/* Section 5: Labs */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 5 — Lab Investigations</Typography>
                    <Autocomplete
                      multiple options={COMMON_LABS} freeSolo
                      value={consultData.labInvestigations || []}
                      onChange={(_, newValue) => setConsultData(prev => ({ ...prev, labInvestigations: newValue }))}
                      renderInput={(params) => <TextField {...params} variant="outlined" placeholder="Select Lab Tests..." />}
                    />
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* RIGHT: History */}
            <Grid size={{ xs: 12, md: 2.5 }} sx={{ position: 'sticky', top: 80, alignSelf: 'flex-start', maxHeight: '80vh', overflowY: 'auto' }}>
              <PatientHistoryTimeline patientId={selectedItem.patient_id} />
            </Grid>
          </Grid>

          {/* ACTIONS */}
          <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, bgcolor: 'white', borderTop: '1px solid #e2e8f0', p: 2, zIndex: 1100, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button variant="outlined" color="error" onClick={() => setOpenCancelDialog(true)}>
              Cancel
            </Button>
            
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={() => handleSave({ isProgress: true })}
              disabled={isFinalizing}
            >
              Save Progress
            </Button>

            <Button 
              variant="contained" 
              color="warning"
              disabled={isFinalizing || !consultData.diagnosis}
              onClick={() => handleSave({ isComplete: true })}
            >
              Complete Diagnosis
            </Button>

            <Tooltip title={!areAllSectionsComplete() ? "Please complete all clinical assessment sections first" : ""}>
              <span>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={() => handleFinalize('WAITING_FOR_PHARMACY')} 
                  disabled={isFinalizing || !consultData.diagnosis || !areAllSectionsComplete()}
                >
                  {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "Complete & Send to Pharmacy"}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}

      <CancelQueueDialog 
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          await cancelQueueItem(cancelTarget.id!, reason);
          setCancelTarget(null);
        }}
        patientName={cancelTarget?.patient_name || ''}
      />
      {lastEncounterId && (
        <PrintPrescriptionDialog 
          open={showPrintDialog} 
          onClose={() => setShowPrintDialog(false)} 
          encounterId={lastEncounterId} 
        />
      )}
      
      <Dialog open={openCancelDialog} onClose={() => setOpenCancelDialog(false)}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight="900" gutterBottom>Cancel Consultation?</Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={() => setOpenCancelDialog(false)}>No</Button>
            <Button variant="contained" color="error" onClick={() => { setOpenCancelDialog(false); setSelectedItem(null); }}>Yes, Cancel</Button>
          </Stack>
        </Box>
      </Dialog>
    </StationLayout>
  );
};

export default DoctorStation;
