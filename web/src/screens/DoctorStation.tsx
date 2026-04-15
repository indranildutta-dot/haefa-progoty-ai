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
  updateEncounterStatus 
} from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import { calculateAgeYears } from '../utils/patient';
import { calculateCVRisk, calculateCVRiskLab, getRiskLevel } from '../utils/cvRisk';

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

export type SectionStatus = 'Not Started' | 'In Progress' | 'Complete';

export interface ClinicalAssessmentData {
  complaints: { date: string; description: string; duration: string }[];
  tbScreening: Record<string, string>;
  suspectedTBAdditionalSymptoms: Record<string, string>;
  suspectedTBExamFindings: Record<string, string>;
  suspectedTBPastHistory: {
    year: string;
    evidence: string[];
    treatment: string;
    duration: string;
    result: string;
    recovery: string;
    others: string;
  };
  physicalExamGeneral: {
    anemia: number;
    jaundice: number;
    edema: number;
    lymphNodesPalpable: boolean;
    heartNAD: boolean;
    lungsNAD: boolean;
  };
  physicalExamSystemic: Record<string, string>;
  currentRx: {
    name: string;
    isAllergic: boolean;
    frequencyHours: string;
    dose: string;
    doseUnit: string;
    duration: string;
    durationUnit: string;
  }[];
  patientHistory: Record<string, { status: string; year?: string }>;
  familyHistory: Record<string, { status: string; records: { year: string; relation: string }[] }>;
  vaccination: Record<string, { received: string; givenByNirog: boolean }>;
  socialHistory: Record<string, string>;
  wellbeing: Record<string, string>;
  reproductiveHealth: {
    obstetric: {
      gravida: string;
      para: string;
      stillBirth: string;
      miscarriage: string;
      mr: string;
      liveMaleBirth: string;
      liveFemaleBirth: string;
      childMortalityMale: string;
      childMortalityFemale: string;
    };
    menstrual: {
      lmp: string;
      contraceptionMethod: string;
      comments: string;
      menstruationProduct: string;
      changeFrequency: string;
    };
    cervicalCancer: {
      consent: string;
      viaResults: string;
      referred: string;
      where: string;
    };
  };
  cvRisk: {
    age: string;
    sex: string;
    bmi: string;
    isSmoker: string;
    sbp: string;
    onBPMedication: string;
    diabetes: string;
  };
  cvRiskLab: {
    age: string;
    sex: string;
    bmi: string;
    isSmoker: string;
    sbp: string;
    onBPMedication: string;
    diabetes: string;
    totalCholesterol: string;
    hdlCholesterol: string;
  };
  sectionStatuses: Record<string, SectionStatus>;
}

export const initialClinicalAssessment: ClinicalAssessmentData = {
  complaints: [],
  tbScreening: {},
  suspectedTBAdditionalSymptoms: {},
  suspectedTBExamFindings: {},
  suspectedTBPastHistory: {
    year: '',
    evidence: [],
    treatment: '',
    duration: '',
    result: '',
    recovery: '',
    others: ''
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
    signsOfMentalIllness: 'No'
  },
  reproductiveHealth: {
    obstetric: {
      gravida: '',
      para: '',
      stillBirth: '',
      miscarriage: '',
      mr: '',
      liveMaleBirth: '',
      liveFemaleBirth: '',
      childMortalityMale: '',
      childMortalityFemale: '',
    },
    menstrual: {
      lmp: '',
      contraceptionMethod: '',
      comments: '',
      menstruationProduct: '',
      changeFrequency: '',
    },
    cervicalCancer: {
      consent: '',
      viaResults: '',
      referred: '',
      where: '',
    },
  },
  cvRisk: {
    age: '',
    sex: '',
    bmi: '',
    isSmoker: '',
    sbp: '',
    onBPMedication: '',
    diabetes: ''
  },
  cvRiskLab: {
    age: '',
    sex: '',
    bmi: '',
    isSmoker: '',
    sbp: '',
    onBPMedication: '',
    diabetes: '',
    totalCholesterol: '',
    hdlCholesterol: ''
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
  treatmentNotes: string;
  prescriptions: any[];
  clinicalAssessment: ClinicalAssessmentData;
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
            value={value.status} 
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
            value={value.status} 
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
                    value={record.year}
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
                  value={record.relation} 
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
                value={complaint.date} 
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
                value={complaint.description} 
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
                value={complaint.duration} 
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
                value={rx.name}
                disabled={!editModes['currentRx']}
                onChange={(e) => {
                  const newRx = [...data.currentRx];
                  newRx[index].name = e.target.value;
                  onChange({ ...data, currentRx: newRx });
                }}
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Dose" value={rx.dose} onChange={(e) => {
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
              <Grid size={4}><TextField fullWidth size="small" label="Gravida" value={data.reproductiveHealth.obstetric.gravida} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, gravida: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Para" value={data.reproductiveHealth.obstetric.para} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, para: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Still Birth" value={data.reproductiveHealth.obstetric.stillBirth} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, stillBirth: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Miscarriage" value={data.reproductiveHealth.obstetric.miscarriage} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, miscarriage: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="MR" value={data.reproductiveHealth.obstetric.mr} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, mr: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Live Birth (M)" value={data.reproductiveHealth.obstetric.liveMaleBirth} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, liveMaleBirth: e.target.value } } });
              }} /></Grid>
              <Grid size={4}><TextField fullWidth size="small" label="Live Birth (F)" value={data.reproductiveHealth.obstetric.liveFemaleBirth} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, obstetric: { ...data.reproductiveHealth.obstetric, liveFemaleBirth: e.target.value } } });
              }} /></Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, fontWeight: 'bold' }}>Menstrual History</Typography>
            <Grid container spacing={2}>
              <Grid size={6}><TextField fullWidth type="date" size="small" label="LMP" InputLabelProps={{ shrink: true }} value={data.reproductiveHealth.menstrual.lmp} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, menstrual: { ...data.reproductiveHealth.menstrual, lmp: e.target.value } } });
              }} /></Grid>
              <Grid size={6}><TextField fullWidth size="small" label="Contraception Method" value={data.reproductiveHealth.menstrual.contraceptionMethod} onChange={(e) => {
                handleStartSection('reproductiveHealth');
                onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, menstrual: { ...data.reproductiveHealth.menstrual, contraceptionMethod: e.target.value } } });
              }} /></Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, fontWeight: 'bold' }}>Cervical Cancer Screening (VIA)</Typography>
            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>VIA Results</InputLabel>
                  <Select value={data.reproductiveHealth.cervicalCancer.viaResults} label="VIA Results" onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({ ...data, reproductiveHealth: { ...data.reproductiveHealth, cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, viaResults: e.target.value } } });
                  }}>
                    <MenuItem value="Negative">Negative</MenuItem>
                    <MenuItem value="Positive">Positive</MenuItem>
                    <MenuItem value="Suspicious">Suspicious</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}><TextField fullWidth size="small" label="Referred To" value={data.reproductiveHealth.cervicalCancer.where} onChange={(e) => {
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
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                WHO CV Risk Assessment for South Asia (Age 40-74)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={4}>
                  <TextField fullWidth size="small" label="SBP" value={data.cvRisk.sbp} onChange={(e) => handleRadioChange('cvRisk', 'sbp', e.target.value)} />
                </Grid>
                <Grid size={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Smoker</InputLabel>
                    <Select value={data.cvRisk.isSmoker} label="Smoker" onChange={(e) => handleRadioChange('cvRisk', 'isSmoker', e.target.value)}>
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Diabetes</InputLabel>
                    <Select value={data.cvRisk.diabetes} label="Diabetes" onChange={(e) => handleRadioChange('cvRisk', 'diabetes', e.target.value)}>
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>On BP Medication</InputLabel>
                    <Select value={data.cvRisk.onBPMedication} label="On BP Medication" onChange={(e) => handleRadioChange('cvRisk', 'onBPMedication', e.target.value)}>
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={expanded === 'cvRiskLab'} onChange={handleChange('cvRiskLab')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            {renderAccordionHeader('cvRiskLab', 'CV Risk Assessment (Lab-Based)', 'cvRiskLab')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('cvRiskLab')}
              <Grid container spacing={2}>
                <Grid size={4}>
                  <TextField fullWidth size="small" label="SBP" value={data.cvRiskLab.sbp} onChange={(e) => handleRadioChange('cvRiskLab', 'sbp', e.target.value)} />
                </Grid>
                <Grid size={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Smoker</InputLabel>
                    <Select value={data.cvRiskLab.isSmoker} label="Smoker" onChange={(e) => handleRadioChange('cvRiskLab', 'isSmoker', e.target.value)}>
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Diabetes</InputLabel>
                    <Select value={data.cvRiskLab.diabetes} label="Diabetes" onChange={(e) => handleRadioChange('cvRiskLab', 'diabetes', e.target.value)}>
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField fullWidth size="small" label="Total Cholesterol" value={data.cvRiskLab.totalCholesterol} onChange={(e) => handleRadioChange('cvRiskLab', 'totalCholesterol', e.target.value)} />
                </Grid>
                <Grid size={6}>
                  <TextField fullWidth size="small" label="HDL Cholesterol" value={data.cvRiskLab.hdlCholesterol} onChange={(e) => handleRadioChange('cvRiskLab', 'hdlCholesterol', e.target.value)} />
                </Grid>
              </Grid>
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
  
  const [consultData, setConsultData] = useState<ConsultationData>({ 
    diagnosis: '', 
    notes: '', 
    treatmentNotes: '', 
    prescriptions: [], 
    clinicalAssessment: initialClinicalAssessment,
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
            console.log("Fetching ICD token from backend Function...");
            const getIcdToken = httpsCallable(functions, 'getIcdToken');
            const result: any = await getIcdToken();
            
            // WHO library expects a plain string token
            console.log("ICD Token received successfully.");
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
      
      // CRITICAL: Manually connect the search tool to the input field
      console.log("Binding ICD-11 search tool to input field...");
      ECT_LIB.Handler.bind("1");
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
      const [patient, vitals] = await Promise.all([
        getPatientById(item.patient_id), 
        getVitalsByEncounter(item.encounter_id)
      ]);
      setCurrentVitals(vitals);
      setSelectedPatient({ ...patient, currentVitals: vitals, triage_level: item.triage_level });
      await updateQueueStatus(item.id, 'IN_CONSULTATION' as any);
      
      setConsultData({
        diagnosis: '', 
        notes: '', 
        treatmentNotes: '', 
        prescriptions: [], 
        clinicalAssessment: initialClinicalAssessment,
        labInvestigations: [],
        referrals: []
      });
    } catch (e) { 
      notify("Error loading patient context.", "error"); 
      console.error(e);
    }
  };

  const handleFinalize = async (status: string) => {
    if (!consultData.diagnosis) {
      notify("A primary diagnosis is required.", "warning");
      return;
    }
    
    setIsFinalizing(true);
    try {
      await saveConsultation({ 
        ...consultData, 
        encounter_id: selectedItem.encounter_id, 
        patient_id: selectedItem.patient_id
      }, {
        encounter_id: selectedItem.encounter_id,
        patient_id: selectedItem.patient_id,
        prescriptions: consultData.prescriptions
      });
      
      await updateQueueStatus(selectedItem.id!, status as any);
      setLastEncounterId(selectedItem.encounter_id);
      setShowPrintDialog(true);
      
      notify("Consultation finalized.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e) { 
      notify("Failed to save consultation.", "error"); 
      console.error(e);
    } finally {
      setIsFinalizing(false);
    }
  };

  const isCRAEligible = calculateAgeYears(selectedPatient) >= 40 && calculateAgeYears(selectedPatient) <= 74;
  const isFemaleOver12 = selectedPatient?.gender === 'female' && calculateAgeYears(selectedPatient) >= 12;

  const isSuspectedTBActive = () => {
    const { cough, lgerf, nightSweat, weightLoss } = consultData.clinicalAssessment.tbScreening;
    const countYes = [lgerf, nightSweat, weightLoss].filter(v => v === 'Yes').length;
    return cough === 'Yes' || countYes >= 2;
  };

  const areAllSectionsComplete = () => {
    const statuses = consultData.clinicalAssessment.sectionStatuses;
    const activeSections = [
      'complaints',
      'tbScreening',
      'physicalExamGeneral',
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
                      <Chip label={item.triage_level?.toUpperCase()} size="small" color={item.triage_level === 'emergency' ? 'error' : 'primary'} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                    <TableCell align="right">
                      <Button variant="contained" onClick={() => handleOpenConsult(item)} sx={{ borderRadius: 2, fontWeight: 700 }}>
                        Start Consultation
                      </Button>
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
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 1 — Clinical Assessment</Typography>
                    <ClinicalAssessmentPanel 
                      data={consultData.clinicalAssessment} 
                      onChange={(val) => setConsultData({ ...consultData, clinicalAssessment: val })} 
                    />
                  </Box>

                  <Divider />

                  {/* Section 2: Notes */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 2 — Symptoms / Notes</Typography>
                    <TextField 
                      fullWidth multiline rows={3} variant="outlined" 
                      value={consultData.notes} 
                      onChange={(e) => setConsultData({ ...consultData, notes: e.target.value })} 
                      placeholder="Enter symptoms..." 
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
                          "data-ctw-ino": "1",
                          autoComplete: "off"
                        }}
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
                    onPrescriptionChange={(prescriptions) => setConsultData({ ...consultData, prescriptions })} 
                  />

                  <Divider />

                  {/* Section 5: Labs */}
                  <Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ mb: 2 }}>Section 5 — Lab Investigations</Typography>
                    <Autocomplete
                      multiple options={COMMON_LABS} freeSolo
                      value={consultData.labInvestigations}
                      onChange={(_, newValue) => setConsultData({ ...consultData, labInvestigations: newValue })}
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
            <Button variant="outlined" color="error" onClick={() => setOpenCancelDialog(true)}>Cancel</Button>
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
