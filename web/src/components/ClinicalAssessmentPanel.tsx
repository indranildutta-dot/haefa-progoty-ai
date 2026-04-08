import React, { useState } from 'react';
import { 
  Box, Typography, Accordion, AccordionSummary, AccordionDetails, 
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
  Switch, TextField, IconButton, Button, Grid, Rating, Checkbox,
  FormGroup, Stack, MenuItem, Select, InputLabel, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import EditIcon from '@mui/icons-material/Edit';
import { useAppStore } from '../store/useAppStore';
import { calculateAgeYears } from '../utils/patient';
import { calculateCVRisk, calculateCVRiskLab, getRiskLevel } from '../utils/cvRisk';

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

interface Props {
  data: ClinicalAssessmentData;
  onChange: (data: ClinicalAssessmentData) => void;
}

const ClinicalAssessmentPanel: React.FC<Props> = ({ data, onChange }) => {
  const [expanded, setExpanded] = useState<string | false>(false);
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});

  const { selectedPatient } = useAppStore();
  const isFemaleOver12 = selectedPatient?.gender?.toLowerCase() === 'female' && calculateAgeYears(selectedPatient) > 12;
  const isChild = calculateAgeYears(selectedPatient) < 18;
  const patientAge = calculateAgeYears(selectedPatient);
  const isCRAEligible = patientAge >= 40 && patientAge <= 74;

  // Auto-populate CV Risk fields when station data is available
  React.useEffect(() => {
    if (selectedPatient && isCRAEligible) {
      const vitals = selectedPatient.currentVitals;
      const sbpValue = vitals?.systolic_2 && !isNaN(vitals.systolic_2) ? vitals.systolic_2 : vitals?.systolic;
      const isSmokerValue = vitals?.social_history?.smoking ? 'Yes' : 'No';
      const hasDiabetesValue = (vitals?.fbg && vitals.fbg >= 126) || 
                          (vitals?.rbg && vitals.rbg >= 200) || 
                          (data.patientHistory['DM']?.status === 'Yes') ? 'Yes' : 'No';

      const updates: Partial<ClinicalAssessmentData> = {};

      if (data.sectionStatuses.cvRisk === 'Not Started') {
        updates.cvRisk = {
          ...data.cvRisk,
          age: patientAge.toString(),
          sex: selectedPatient.gender === 'male' ? 'Men' : 'Women',
          bmi: vitals?.bmi ? vitals.bmi.toString() : '',
          isSmoker: isSmokerValue,
          sbp: sbpValue ? sbpValue.toString() : '',
          diabetes: hasDiabetesValue,
          onBPMedication: data.cvRisk.onBPMedication || 'No'
        };
      }

      if (data.sectionStatuses.cvRiskLab === 'Not Started') {
        updates.cvRiskLab = {
          ...data.cvRiskLab,
          age: patientAge.toString(),
          sex: selectedPatient.gender === 'male' ? 'Men' : 'Women',
          bmi: vitals?.bmi ? vitals.bmi.toString() : '',
          isSmoker: isSmokerValue,
          sbp: sbpValue ? sbpValue.toString() : '',
          diabetes: hasDiabetesValue,
          onBPMedication: data.cvRiskLab.onBPMedication || 'No'
        };
      }

      if (Object.keys(updates).length > 0) {
        onChange({ ...data, ...updates });
      }
    }
  }, [selectedPatient, isCRAEligible]);

  const cvRiskPercentage = calculateCVRisk({
    age: parseInt(data.cvRisk.age),
    gender: data.cvRisk.sex as any,
    isSmoker: data.cvRisk.isSmoker === 'Yes',
    bmi: parseFloat(data.cvRisk.bmi),
    sbp: parseFloat(data.cvRisk.sbp)
  });

  const riskInfo = cvRiskPercentage !== null ? getRiskLevel(cvRiskPercentage) : null;

  const cvRiskLabPercentage = calculateCVRiskLab({
    age: parseInt(data.cvRiskLab.age),
    gender: data.cvRiskLab.sex as any,
    isSmoker: data.cvRiskLab.isSmoker === 'Yes',
    sbp: parseFloat(data.cvRiskLab.sbp),
    hasDiabetes: data.cvRiskLab.diabetes === 'Yes',
    totalCholesterol: parseFloat(data.cvRiskLab.totalCholesterol)
  });

  const riskInfoLab = cvRiskLabPercentage !== null ? getRiskLevel(cvRiskLabPercentage) : null;

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

  const renderFamilyHistoryGroup = (field: string, label: string) => {
    const value = data.familyHistory[field] || { status: '', records: [] };
    const section = 'familyHistory';
    
    return (
      <Box key={field} sx={{ mb: 2, p: 1.5, bgcolor: value.status === 'In The Past' ? '#f8fafc' : 'transparent', borderRadius: 2, border: value.status === 'In The Past' ? '1px solid #e2e8f0' : 'none', opacity: editModes[section] ? 1 : 0.6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={value.status === 'In The Past' ? 'bold' : 'normal'}>{label}</Typography>
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
          <Box sx={{ mt: 1.5, pl: 2, borderLeft: '2px solid #3b82f6' }}>
            {value.records.map((record, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={record.year}
                    label="Year"
                    disabled={!editModes[section]}
                    onChange={(e) => {
                      const newRecords = [...value.records];
                      newRecords[idx].year = e.target.value as string;
                      onChange({
                        ...data,
                        familyHistory: {
                          ...data.familyHistory,
                          [field]: { ...value, records: newRecords }
                        }
                      });
                    }}
                  >
                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Relation</InputLabel>
                  <Select
                    value={record.relation}
                    label="Relation"
                    disabled={!editModes[section]}
                    onChange={(e) => {
                      const newRecords = [...value.records];
                      newRecords[idx].relation = e.target.value as string;
                      onChange({
                        ...data,
                        familyHistory: {
                          ...data.familyHistory,
                          [field]: { ...value, records: newRecords }
                        }
                      });
                    }}
                  >
                    {['Mom', 'Dad', 'Brother-In-Law', 'Sister-In-Law', 'Mother-In-Law', 'Father-In-Law', 'Son', 'Daughter', 'Uncle', 'Aunt'].map(rel => (
                      <MenuItem key={rel} value={rel}>{rel}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <IconButton 
                  size="small" 
                  color="error" 
                  disabled={!editModes[section]}
                  onClick={() => {
                    const newRecords = value.records.filter((_, i) => i !== idx);
                    onChange({
                      ...data,
                      familyHistory: {
                        ...data.familyHistory,
                        [field]: { ...value, records: newRecords }
                      }
                    });
                  }}
                >
                  <RemoveCircleIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button 
              size="small" 
              startIcon={<AddCircleIcon />} 
              disabled={!editModes[section]}
              onClick={() => {
                const newRecords = [...value.records, { year: '', relation: '' }];
                onChange({
                  ...data,
                  familyHistory: {
                    ...data.familyHistory,
                    [field]: { ...value, records: newRecords }
                  }
                });
              }}
              sx={{ fontSize: '0.7rem', mt: 0.5 }}
            >
              Add Family Member
            </Button>
          </Box>
        )}
      </Box>
    );
  };

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

      {/* Suspected TB Additional History */}
      {isSuspectedTBActive() && (
        <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
            Additional History for Suspected TB Cases (PTB only)
          </Typography>
          
          {/* Additional Symptoms */}
          <Accordion expanded={expanded === 'suspectedTBAdditionalSymptoms'} onChange={handleChange('suspectedTBAdditionalSymptoms')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
            {renderAccordionHeader('suspectedTBAdditionalSymptoms', 'Additional Symptoms', 'suspectedTBAdditionalSymptoms')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('suspectedTBAdditionalSymptoms', ['breathlessness', 'chestPain', 'lossOfAppetite', 'hemoptysis', 'others'])}
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you have any of the following Symptoms?</Typography>
              {renderYesNoGroup('suspectedTBAdditionalSymptoms', 'breathlessness', 'Breathlessness')}
              {renderYesNoGroup('suspectedTBAdditionalSymptoms', 'chestPain', 'Chest Pain')}
              {renderYesNoGroup('suspectedTBAdditionalSymptoms', 'lossOfAppetite', 'Loss of appetite')}
              {renderYesNoGroup('suspectedTBAdditionalSymptoms', 'hemoptysis', 'Hemoptysis (Coughing up to blood)')}
              {renderYesNoGroup('suspectedTBAdditionalSymptoms', 'others', 'Others')}
            </AccordionDetails>
          </Accordion>

          {/* Examination Finding */}
          <Accordion expanded={expanded === 'suspectedTBExamFindings'} onChange={handleChange('suspectedTBExamFindings')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
            {renderAccordionHeader('suspectedTBExamFindings', 'Examination Finding: Please Auscultate Lungs', 'suspectedTBExamFindings')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('suspectedTBExamFindings', ['pleuralEffusion', 'consolidation', 'crepitation', 'others'])}
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you have any of the following Symptoms?</Typography>
              {renderYesNoGroup('suspectedTBExamFindings', 'pleuralEffusion', 'Signs of pleural effusion')}
              {renderYesNoGroup('suspectedTBExamFindings', 'consolidation', 'Signs of consolidation')}
              {renderYesNoGroup('suspectedTBExamFindings', 'crepitation', 'Crepitation')}
              {renderYesNoGroup('suspectedTBExamFindings', 'others', 'Others')}
            </AccordionDetails>
          </Accordion>

          {/* TB Past History */}
          <Accordion expanded={expanded === 'suspectedTBPastHistory'} onChange={handleChange('suspectedTBPastHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            {renderAccordionHeader('suspectedTBPastHistory', 'TB Past History', 'suspectedTBPastHistory')}
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {renderSectionControls('suspectedTBPastHistory')}
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you have Past TB History?</Typography>
              
              <Box sx={{ mb: 3, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={6}>
                    <Typography variant="body2">When did he suffer TB in past</Typography>
                  </Grid>
                  <Grid size={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Year</InputLabel>
                      <Select
                        value={data.suspectedTBPastHistory.year}
                        label="Select Year"
                        disabled={!editModes['suspectedTBPastHistory']}
                        onChange={(e) => {
                          handleStartSection('suspectedTBPastHistory');
                          onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, year: e.target.value as string } });
                        }}
                      >
                        {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Evidenced was</Typography>
                <FormGroup>
                  {[
                    { id: 'sputumPositive', label: 'Sputum was positive' },
                    { id: 'chestXray', label: 'Chest X-ray was suggestive' },
                    { id: 'mtbDetected', label: 'MTB detected by gene X-pert' },
                    { id: 'diagnosedPhysician', label: 'Diagnosed by qualified physician' },
                    { id: 'noEvidence', label: 'No evidence (Trial drug)' }
                  ].map((item) => (
                    <FormControlLabel 
                      key={item.id}
                      control={
                        <Checkbox 
                          size="small" 
                          disabled={!editModes['suspectedTBPastHistory']}
                          checked={data.suspectedTBPastHistory.evidence.includes(item.id)}
                          onChange={(e) => {
                            handleStartSection('suspectedTBPastHistory');
                            const newEvidence = e.target.checked 
                              ? [...data.suspectedTBPastHistory.evidence, item.id]
                              : data.suspectedTBPastHistory.evidence.filter(id => id !== item.id);
                            onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, evidence: newEvidence } });
                          }}
                        />
                      } 
                      label={<Typography variant="caption">{item.label}</Typography>} 
                    />
                  ))}
                </FormGroup>
              </Box>

              <Box sx={{ mb: 2, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Typography variant="body2">Treatment received</Typography>
                <RadioGroup 
                  row 
                  value={data.suspectedTBPastHistory.treatment}
                  onChange={(e) => {
                    handleStartSection('suspectedTBPastHistory');
                    onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, treatment: e.target.value } });
                  }}
                >
                  <FormControlLabel value="Cat 2" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Cat 2</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Cat 1" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Cat 1</Typography>} />
                </RadioGroup>
              </Box>

              <Box sx={{ mb: 2, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Typography variant="body2">Duration of treatment</Typography>
                <RadioGroup 
                  row 
                  value={data.suspectedTBPastHistory.duration}
                  onChange={(e) => {
                    handleStartSection('suspectedTBPastHistory');
                    onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, duration: e.target.value } });
                  }}
                >
                  <FormControlLabel value="8 Months" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">8 Months</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Other" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Other</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="6 Months" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">6 Months</Typography>} />
                </RadioGroup>
              </Box>

              <Box sx={{ mb: 2, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Typography variant="body2">Result of treatment</Typography>
                <RadioGroup 
                  row 
                  value={data.suspectedTBPastHistory.result}
                  onChange={(e) => {
                    handleStartSection('suspectedTBPastHistory');
                    onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, result: e.target.value } });
                  }}
                >
                  <FormControlLabel value="In Completed" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">In Completed</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Completed" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Completed</Typography>} />
                </RadioGroup>
              </Box>

              <Box sx={{ mb: 2, opacity: editModes['suspectedTBPastHistory'] ? 1 : 0.6 }}>
                <Typography variant="body2">Recovery Status</Typography>
                <RadioGroup 
                  row 
                  value={data.suspectedTBPastHistory.recovery}
                  onChange={(e) => {
                    handleStartSection('suspectedTBPastHistory');
                    onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, recovery: e.target.value } });
                  }}
                >
                  <FormControlLabel value="Not Recovered" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Not Recovered</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Recovered" control={<Radio size="small" disabled={!editModes['suspectedTBPastHistory']} />} label={<Typography variant="caption">Recovered</Typography>} />
                </RadioGroup>
              </Box>

              <TextField 
                fullWidth 
                label="Others" 
                size="small"
                value={data.suspectedTBPastHistory.others}
                disabled={!editModes['suspectedTBPastHistory']}
                onChange={(e) => {
                  handleStartSection('suspectedTBPastHistory');
                  onChange({ ...data, suspectedTBPastHistory: { ...data.suspectedTBPastHistory, others: e.target.value } });
                }}
              />
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Lymph Nodes with Palpable</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.lymphNodesPalpable ? 'YES' : 'NO'}</Typography>
              <Switch 
                size="small"
                disabled={!editModes['physicalExamGeneral']}
                checked={data.physicalExamGeneral.lymphNodesPalpable} 
                onChange={(e) => {
                  handleStartSection('physicalExamGeneral');
                  onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, lymphNodesPalpable: e.target.checked } });
                }} 
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Heart with NAD</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.heartNAD ? 'YES' : 'NO'}</Typography>
              <Switch 
                size="small"
                disabled={!editModes['physicalExamGeneral']}
                checked={data.physicalExamGeneral.heartNAD} 
                onChange={(e) => {
                  handleStartSection('physicalExamGeneral');
                  onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, heartNAD: e.target.checked } });
                }} 
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['physicalExamGeneral'] ? 1 : 0.6 }}>
            <Typography variant="body2">Lungs with NAD</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.lungsNAD ? 'YES' : 'NO'}</Typography>
              <Switch 
                size="small"
                disabled={!editModes['physicalExamGeneral']}
                checked={data.physicalExamGeneral.lungsNAD} 
                onChange={(e) => {
                  handleStartSection('physicalExamGeneral');
                  onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, lungsNAD: e.target.checked } });
                }} 
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Physical Examination - Systemic */}
      <Accordion expanded={expanded === 'physicalExamSystemic'} onChange={handleChange('physicalExamSystemic')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('physicalExamSystemic', 'Physical Examination - Systemic', 'physicalExamSystemic')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('physicalExamSystemic')}
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>-- Select System --</InputLabel>
            <Select
              label="-- Select System --"
              disabled={!editModes['physicalExamSystemic']}
              value=""
              onChange={(e) => {
                const system = e.target.value as string;
                if (!data.physicalExamSystemic[system]) {
                  handleStartSection('physicalExamSystemic');
                  onChange({
                    ...data,
                    physicalExamSystemic: {
                      ...data.physicalExamSystemic,
                      [system]: ''
                    }
                  });
                }
              }}
            >
              <MenuItem value="Cardiovascular System">Cardiovascular System</MenuItem>
              <MenuItem value="Respiratory System">Respiratory System</MenuItem>
              <MenuItem value="Nervous System">Nervous System</MenuItem>
              <MenuItem value="Abdominal">Abdominal</MenuItem>
              <MenuItem value="Musculoskeletal">Musculoskeletal</MenuItem>
            </Select>
          </FormControl>

          {Object.entries(data.physicalExamSystemic).map(([system, findings]) => (
            <Box key={system} sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary">{system}</Typography>
                <IconButton 
                  size="small" 
                  color="error" 
                  disabled={!editModes['physicalExamSystemic']}
                  onClick={() => {
                    const newSystemic = { ...data.physicalExamSystemic };
                    delete newSystemic[system];
                    onChange({ ...data, physicalExamSystemic: newSystemic });
                  }}
                >
                  <RemoveCircleIcon fontSize="small" />
                </IconButton>
              </Box>
              <TextField 
                fullWidth 
                multiline 
                rows={2} 
                placeholder={`Enter findings for ${system}...`} 
                value={findings} 
                disabled={!editModes['physicalExamSystemic']}
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
            </Box>
          ))}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="900">Medication #{index + 1}</Typography>
                <IconButton 
                  color="error" 
                  disabled={!editModes['currentRx']}
                  onClick={() => {
                    const newRx = data.currentRx.filter((_, i) => i !== index);
                    onChange({ ...data, currentRx: newRx });
                  }}
                >
                  <RemoveCircleIcon />
                </IconButton>
              </Box>

              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField 
                    fullWidth 
                    label="Enter Medicine Name" 
                    size="small"
                    value={rx.name}
                    disabled={!editModes['currentRx']}
                    onChange={(e) => {
                      const newRx = [...data.currentRx];
                      newRx[index].name = e.target.value;
                      onChange({ ...data, currentRx: newRx });
                    }}
                  />
                </Grid>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={rx.isAllergic} 
                        disabled={!editModes['currentRx']}
                        onChange={(e) => {
                          const newRx = [...data.currentRx];
                          newRx[index].isAllergic = e.target.checked;
                          onChange({ ...data, currentRx: newRx });
                        }}
                      />
                    }
                    label={<Typography variant="body2">Allergy to medication</Typography>}
                  />
                </Grid>
                <Grid size={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Frequency Hours</InputLabel>
                    <Select
                      label="Frequency Hours"
                      value={rx.frequencyHours}
                      disabled={!editModes['currentRx']}
                      onChange={(e) => {
                        const newRx = [...data.currentRx];
                        newRx[index].frequencyHours = e.target.value;
                        onChange({ ...data, currentRx: newRx });
                      }}
                    >
                      <MenuItem value="4">Every 4 hours</MenuItem>
                      <MenuItem value="6">Every 6 hours</MenuItem>
                      <MenuItem value="8">Every 8 hours</MenuItem>
                      <MenuItem value="12">Every 12 hours</MenuItem>
                      <MenuItem value="24">Once daily</MenuItem>
                      <MenuItem value="PRN">As needed (PRN)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField 
                    fullWidth 
                    label="Dos : 10, 20..." 
                    size="small"
                    value={rx.dose}
                    disabled={!editModes['currentRx']}
                    onChange={(e) => {
                      const newRx = [...data.currentRx];
                      newRx[index].dose = e.target.value;
                      onChange({ ...data, currentRx: newRx });
                    }}
                  />
                </Grid>
                <Grid size={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>unit</InputLabel>
                    <Select
                      label="unit"
                      value={rx.doseUnit}
                      disabled={!editModes['currentRx']}
                      onChange={(e) => {
                        const newRx = [...data.currentRx];
                        newRx[index].doseUnit = e.target.value;
                        onChange({ ...data, currentRx: newRx });
                      }}
                    >
                      <MenuItem value="mg">mg</MenuItem>
                      <MenuItem value="ml">ml</MenuItem>
                      <MenuItem value="tablet">tablet</MenuItem>
                      <MenuItem value="capsule">capsule</MenuItem>
                      <MenuItem value="drop">drop</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField 
                    fullWidth 
                    label="Duration : 1, 2..." 
                    size="small"
                    value={rx.duration}
                    disabled={!editModes['currentRx']}
                    onChange={(e) => {
                      const newRx = [...data.currentRx];
                      newRx[index].duration = e.target.value;
                      onChange({ ...data, currentRx: newRx });
                    }}
                  />
                </Grid>
                <Grid size={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>unit</InputLabel>
                    <Select
                      label="unit"
                      value={rx.durationUnit}
                      disabled={!editModes['currentRx']}
                      onChange={(e) => {
                        const newRx = [...data.currentRx];
                        newRx[index].durationUnit = e.target.value;
                        onChange({ ...data, currentRx: newRx });
                      }}
                    >
                      <MenuItem value="days">days</MenuItem>
                      <MenuItem value="weeks">weeks</MenuItem>
                      <MenuItem value="months">months</MenuItem>
                      <MenuItem value="years">years</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient H/O illness */}
      <Accordion expanded={expanded === 'patientHistory'} onChange={handleChange('patientHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('patientHistory', 'Patient H/O illness', 'patientHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('patientHistory', ['Cancer', 'Malaria', 'Skin disease', 'Asthma', 'Hypertension', 'DM', 'Surgery', 'Others', 'TB', 'Typhoid', 'Fracture/injury', 'Hepatitis', 'IHD', 'Depression', 'Stroke', 'Dengue'])}
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you have any of the following diseases?</Typography>
          {['Cancer', 'Malaria', 'Skin disease', 'Asthma', 'Hypertension', 'DM', 'Surgery', 'Others', 'TB', 'Typhoid', 'Fracture/injury', 'Hepatitis', 'IHD', 'Depression', 'Stroke', 'Dengue'].map((illness) => (
            renderPatientHistoryGroup(illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Family H/O illness */}
      <Accordion expanded={expanded === 'familyHistory'} onChange={handleChange('familyHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('familyHistory', 'Family H/O illness', 'familyHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('familyHistory', ['Cancer', 'Malaria', 'Skin disease', 'Asthma', 'Hypertension', 'DM', 'Surgery', 'Others', 'TB', 'Typhoid', 'Fracture/injury', 'Hepatitis', 'IHD', 'Depression', 'Stroke', 'Dengue'])}
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Does your family have any of the following diseases?</Typography>
          {['Cancer', 'Malaria', 'Skin disease', 'Asthma', 'Hypertension', 'DM', 'Surgery', 'Others', 'TB', 'Typhoid', 'Fracture/injury', 'Hepatitis', 'IHD', 'Depression', 'Stroke', 'Dengue'].map((illness) => (
            renderFamilyHistoryGroup(illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Vaccination */}
      <Accordion expanded={expanded === 'vaccination'} onChange={handleChange('vaccination')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('vaccination', isChild ? 'Vaccination - Children' : 'Vaccination - Adult', 'vaccination')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('vaccination')}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid size={6}><Typography variant="subtitle2">Did you get the following vaccinations?</Typography></Grid>
            <Grid size={6} sx={{ textAlign: 'right' }}><Typography variant="caption">Given by Nirog Team?</Typography></Grid>
          </Grid>
          {(isChild 
            ? ['BCG', 'Pentavalent', 'OPV', 'PCV', 'IPV', 'MR', 'Measles', 'Rubella', 'Chicken Pox', 'Covid-19']
            : ['BCG', 'Pentavalent', 'OPV', 'PCV', 'MR', 'Measles', 'Chicken Pox', 'Covid-19', 'TT', 'Cholera: Dose-1', 'Cholera: Dose-2', 'Cholera: Dose-3']
          ).map((vax) => (
            <Box key={vax} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1, opacity: editModes['vaccination'] ? 1 : 0.6 }}>
              <Typography variant="body2" sx={{ width: '30%' }}>{vax}</Typography>
              <RadioGroup 
                row 
                value={data.vaccination[vax]?.received || ''} 
                onChange={(e) => {
                  handleStartSection('vaccination');
                  onChange({ ...data, vaccination: { ...data.vaccination, [vax]: { ...data.vaccination[vax], received: e.target.value } } });
                }}
              >
                <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes['vaccination']} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 1 }} />
                <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes['vaccination']} />} label={<Typography variant="caption">Yes</Typography>} />
              </RadioGroup>
              <Checkbox 
                size="small"
                disabled={!editModes['vaccination']}
                checked={data.vaccination[vax]?.givenByNirog || false} 
                onChange={(e) => {
                  handleStartSection('vaccination');
                  onChange({ ...data, vaccination: { ...data.vaccination, [vax]: { ...data.vaccination[vax], givenByNirog: e.target.checked } } });
                }} 
              />
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient Social H/O */}
      <Accordion expanded={expanded === 'socialHistory'} onChange={handleChange('socialHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('socialHistory', 'Patient Social H/O', 'socialHistory')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('socialHistory', ['Alcohol', 'Drugs', 'Smoking', 'Betel Nuts', 'Chewing tobacco', 'Other'])}
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you take any of the following?</Typography>
          {['Alcohol', 'Drugs', 'Smoking', 'Betel Nuts', 'Chewing tobacco', 'Other'].map((item) => (
            renderYesNoGroup('socialHistory', item, item)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient Wellbeing */}
      <Accordion expanded={expanded === 'wellbeing'} onChange={handleChange('wellbeing')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('wellbeing', 'Patient Wellbeing', 'wellbeing')}
        <AccordionDetails sx={{ bgcolor: 'white' }}>
          {renderSectionControls('wellbeing')}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, opacity: editModes['wellbeing'] ? 1 : 0.6 }}>
            <Typography variant="body2">Any sign of mental illness, stress or depression?</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.wellbeing.signsOfMentalIllness}</Typography>
              <Switch 
                size="small"
                disabled={!editModes['wellbeing']}
                checked={data.wellbeing.signsOfMentalIllness === 'Yes'} 
                onChange={(e) => {
                  handleStartSection('wellbeing');
                  onChange({ ...data, wellbeing: { ...data.wellbeing, signsOfMentalIllness: e.target.checked ? 'Yes' : 'No' } });
                }} 
              />
            </Box>
          </Box>

          {[
            { id: 'happyPerson', label: '1. Have you been a happy person?', options: ['Always', 'Sometime', 'Never'] },
            { id: 'nervousTense', label: '2. Do you feel nervous/tense?', options: ['Always', 'Sometime', 'Never'] },
            { id: 'sadDownhearted', label: '3. Do you feel sad/downhearted?', options: ['Always', 'Sometime', 'Never'] },
            { id: 'visitedFamilyFriends', label: '4. In the past 1 month, have you visited family/friends?', options: ['Yes', 'No'] },
            { id: 'mentalStateAffectedWork', label: '5. In the past 1 month, have your mental state negatively affected your work/productivity?', options: ['Yes', 'No'] },
            { id: 'healthFeeling', label: '6. How do you feel about your health?', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
            { id: 'healthComparedToLastYear', label: '7. Compared to 1 year ago, your general health is', options: ['Better', 'Same', 'Worse'] }
          ].map((q) => (
            <Box key={q.id} sx={{ mb: 2, opacity: editModes['wellbeing'] ? 1 : 0.6 }}>
              <Typography variant="subtitle2">{q.label}</Typography>
              <RadioGroup 
                row 
                value={data.wellbeing[q.id] || ''} 
                onChange={(e) => handleRadioChange('wellbeing', q.id, e.target.value)}
              >
                {q.options.map(opt => (
                  <FormControlLabel key={opt} value={opt} control={<Radio size="small" disabled={!editModes['wellbeing']} />} label={<Typography variant="caption">{opt}</Typography>} sx={{ mr: 2 }} />
                ))}
              </RadioGroup>
            </Box>
          ))}

          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 2, bgcolor: 'grey.300', p: 1 }}>Does your health limit you to do the following?</Typography>
          
          {[
            { id: 'limitVigorousActivity', label: '8. Vigorous activity/running' },
            { id: 'limitModerateHousework', label: '9. Moderate/housework' },
            { id: 'limitClimbingStairs', label: '10. Climbing stairs' },
            { id: 'limitClimbing1Flight', label: '11. Climbing 1 flight of stairs' },
            { id: 'limitBendingKneeling', label: '12. Bending/kneeling' },
            { id: 'limitWalkMile', label: '13. Walk a mile' },
            { id: 'limitWalkSeveralBlocks', label: '14. Walk several blocks' },
            { id: 'limitWalkOneBlock', label: '15. Walk one block' }
          ].map((item) => (
            <Box key={item.id} sx={{ mb: 2, opacity: editModes['wellbeing'] ? 1 : 0.6 }}>
              <Typography variant="subtitle2">{item.label}</Typography>
              <RadioGroup 
                row 
                value={data.wellbeing[item.id] || ''} 
                onChange={(e) => handleRadioChange('wellbeing', item.id, e.target.value)}
              >
                <FormControlLabel value="Limited a lot" control={<Radio size="small" disabled={!editModes['wellbeing']} />} label={<Typography variant="caption">Limited a lot</Typography>} sx={{ mr: 2 }} />
                <FormControlLabel value="Limited a little" control={<Radio size="small" disabled={!editModes['wellbeing']} />} label={<Typography variant="caption">Limited a little</Typography>} sx={{ mr: 2 }} />
                <FormControlLabel value="Not limited" control={<Radio size="small" disabled={!editModes['wellbeing']} />} label={<Typography variant="caption">Not limited</Typography>} />
              </RadioGroup>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>
      {/* Reproductive Health (Female > 12 only) */}
      {isFemaleOver12 && (
        <Accordion expanded={expanded === 'reproductiveHealth'} onChange={handleChange('reproductiveHealth')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          {renderAccordionHeader('reproductiveHealth', 'Reproductive Health', 'reproductiveHealth')}
          <AccordionDetails sx={{ bgcolor: 'white' }}>
            {renderSectionControls('reproductiveHealth')}
            
            {/* Obstetric History */}
            <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
              Obstetric History
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3, opacity: editModes['reproductiveHealth'] ? 1 : 0.6 }}>
              {[
                { id: 'gravida', label: 'Gravida', placeholder: 'Ex: 1' },
                { id: 'para', label: 'Para', placeholder: 'Ex: 1' },
                { id: 'stillBirth', label: 'Still Birth', placeholder: 'Ex: 1' },
                { id: 'miscarriage', label: 'Miscarriage', placeholder: 'Ex: 0' },
                { id: 'mr', label: 'MR', placeholder: 'Ex: 0' },
                { id: 'liveMaleBirth', label: 'Live Male Birth', placeholder: 'Ex: 1' },
                { id: 'liveFemaleBirth', label: 'Live Female Birth', placeholder: 'Ex: 1' },
              ].map((field) => (
                <Grid size={{ xs: 12, sm: 6 }} key={field.id}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>{field.label}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={field.placeholder}
                    disabled={!editModes['reproductiveHealth']}
                    value={(data.reproductiveHealth.obstetric as any)[field.id]}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          obstetric: { ...data.reproductiveHealth.obstetric, [field.id]: e.target.value }
                        }
                      });
                    }}
                  />
                </Grid>
              ))}
              
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Child Mortality</Typography>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Male</InputLabel>
                      <Select
                        label="Male"
                        disabled={!editModes['reproductiveHealth']}
                        value={data.reproductiveHealth.obstetric.childMortalityMale}
                        onChange={(e) => {
                          handleStartSection('reproductiveHealth');
                          onChange({
                            ...data,
                            reproductiveHealth: {
                              ...data.reproductiveHealth,
                              obstetric: { ...data.reproductiveHealth.obstetric, childMortalityMale: e.target.value }
                            }
                          });
                        }}
                      >
                        <MenuItem value="">-- Select --</MenuItem>
                        {[0, 1, 2, 3, 4, 5, '5+'].map(v => <MenuItem key={v} value={v.toString()}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Female</InputLabel>
                      <Select
                        label="Female"
                        disabled={!editModes['reproductiveHealth']}
                        value={data.reproductiveHealth.obstetric.childMortalityFemale}
                        onChange={(e) => {
                          handleStartSection('reproductiveHealth');
                          onChange({
                            ...data,
                            reproductiveHealth: {
                              ...data.reproductiveHealth,
                              obstetric: { ...data.reproductiveHealth.obstetric, childMortalityFemale: e.target.value }
                            }
                          });
                        }}
                      >
                        <MenuItem value="">-- Select --</MenuItem>
                        {[0, 1, 2, 3, 4, 5, '5+'].map(v => <MenuItem key={v} value={v.toString()}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>

            {/* Menstrual History */}
            <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
              Menstrual History
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3, opacity: editModes['reproductiveHealth'] ? 1 : 0.6 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>LMP</Typography>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  disabled={!editModes['reproductiveHealth']}
                  value={data.reproductiveHealth.menstrual.lmp}
                  onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({
                      ...data,
                      reproductiveHealth: {
                        ...data.reproductiveHealth,
                        menstrual: { ...data.reproductiveHealth.menstrual, lmp: e.target.value }
                      }
                    });
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>* Contraception Method</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    disabled={!editModes['reproductiveHealth']}
                    value={data.reproductiveHealth.menstrual.contraceptionMethod}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          menstrual: { ...data.reproductiveHealth.menstrual, contraceptionMethod: e.target.value }
                        }
                      });
                    }}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {['None', 'Oral Pill', 'Injectable', 'IUD', 'Implant', 'Condom', 'Permanent', 'Others'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Comments</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="type here"
                  disabled={!editModes['reproductiveHealth']}
                  value={data.reproductiveHealth.menstrual.comments}
                  onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({
                      ...data,
                      reproductiveHealth: {
                        ...data.reproductiveHealth,
                        menstrual: { ...data.reproductiveHealth.menstrual, comments: e.target.value }
                      }
                    });
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>* What Product You Use During Menstruation?</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    disabled={!editModes['reproductiveHealth']}
                    value={data.reproductiveHealth.menstrual.menstruationProduct}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          menstrual: { ...data.reproductiveHealth.menstrual, menstruationProduct: e.target.value }
                        }
                      });
                    }}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {['Sanitary Pad', 'Cloth', 'Menstrual Cup', 'Tampon', 'Others'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>* How Often Do You Change / Replace?</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    disabled={!editModes['reproductiveHealth']}
                    value={data.reproductiveHealth.menstrual.changeFrequency}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          menstrual: { ...data.reproductiveHealth.menstrual, changeFrequency: e.target.value }
                        }
                      });
                    }}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {['1-2 times/day', '3-4 times/day', '5+ times/day', 'As needed'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Cervical Cancer Screening */}
            <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
              Cervical Cancer Screening
            </Typography>
            <Box sx={{ opacity: editModes['reproductiveHealth'] ? 1 : 0.6 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2">Does patient give consent to cervical cancer screening?</Typography>
                <RadioGroup 
                  row 
                  value={data.reproductiveHealth.cervicalCancer.consent}
                  onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({
                      ...data,
                      reproductiveHealth: {
                        ...data.reproductiveHealth,
                        cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, consent: e.target.value }
                      }
                    });
                  }}
                >
                  <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes['reproductiveHealth']} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes['reproductiveHealth']} />} label={<Typography variant="caption">Yes</Typography>} />
                </RadioGroup>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Cervical cancer screening (VIA) results</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    disabled={!editModes['reproductiveHealth']}
                    value={data.reproductiveHealth.cervicalCancer.viaResults}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, viaResults: e.target.value }
                        }
                      });
                    }}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {['Negative', 'Positive', 'Suspicious of Cancer', 'Inconclusive'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2">Referred for colposcopy / biopsy</Typography>
                <RadioGroup 
                  row 
                  value={data.reproductiveHealth.cervicalCancer.referred}
                  onChange={(e) => {
                    handleStartSection('reproductiveHealth');
                    onChange({
                      ...data,
                      reproductiveHealth: {
                        ...data.reproductiveHealth,
                        cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, referred: e.target.value }
                      }
                    });
                  }}
                >
                  <FormControlLabel value="No" control={<Radio size="small" disabled={!editModes['reproductiveHealth']} />} label={<Typography variant="caption">No</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="Yes" control={<Radio size="small" disabled={!editModes['reproductiveHealth']} />} label={<Typography variant="caption">Yes</Typography>} />
                </RadioGroup>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Where?</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    disabled={!editModes['reproductiveHealth']}
                    value={data.reproductiveHealth.cervicalCancer.where}
                    onChange={(e) => {
                      handleStartSection('reproductiveHealth');
                      onChange({
                        ...data,
                        reproductiveHealth: {
                          ...data.reproductiveHealth,
                          cervicalCancer: { ...data.reproductiveHealth.cervicalCancer, where: e.target.value }
                        }
                      });
                    }}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {['District Hospital', 'Medical College', 'Specialized Center', 'Others'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Cardiovascular Risk - Non Lab Based (Age 40-74 only) */}
      {isCRAEligible && (
        <Accordion expanded={expanded === 'cvRisk'} onChange={handleChange('cvRisk')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          {renderAccordionHeader('cvRisk', 'Cardiovascular Risk - Non Lab Based', 'cvRisk')}
          <AccordionDetails sx={{ bgcolor: 'white' }}>
            {renderSectionControls('cvRisk')}
            
            <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
              CRA
            </Typography>

            <Grid container spacing={3} sx={{ opacity: editModes['cvRisk'] ? 1 : 0.6 }}>
              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Age</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRisk.age}
                  disabled
                  helperText="Between : 40-74"
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Sex</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRisk.sex}
                    disabled={!editModes['cvRisk']}
                    onChange={(e) => {
                      handleStartSection('cvRisk');
                      onChange({ ...data, cvRisk: { ...data.cvRisk, sex: e.target.value } });
                    }}
                  >
                    <MenuItem value="Men">Men</MenuItem>
                    <MenuItem value="Women">Women</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>BMI</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRisk.bmi}
                  disabled={!editModes['cvRisk']}
                  onChange={(e) => {
                    handleStartSection('cvRisk');
                    onChange({ ...data, cvRisk: { ...data.cvRisk, bmi: e.target.value } });
                  }}
                  placeholder="-- Select --"
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Cigarette Smoker</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRisk.isSmoker}
                    disabled={!editModes['cvRisk']}
                    onChange={(e) => {
                      handleStartSection('cvRisk');
                      onChange({ ...data, cvRisk: { ...data.cvRisk, isSmoker: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Systolic Blood Pressure</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRisk.sbp}
                  disabled={!editModes['cvRisk']}
                  onChange={(e) => {
                    handleStartSection('cvRisk');
                    onChange({ ...data, cvRisk: { ...data.cvRisk, sbp: e.target.value } });
                  }}
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>On Blood Pressure Medication</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRisk.onBPMedication}
                    disabled={!editModes['cvRisk']}
                    onChange={(e) => {
                      handleStartSection('cvRisk');
                      onChange({ ...data, cvRisk: { ...data.cvRisk, onBPMedication: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Diabetes</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRisk.diabetes}
                    disabled={!editModes['cvRisk']}
                    onChange={(e) => {
                      handleStartSection('cvRisk');
                      onChange({ ...data, cvRisk: { ...data.cvRisk, diabetes: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Result Section */}
            <Box sx={{ mt: 4, pt: 3, borderTop: '2px solid #e2e8f0', textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Result</Typography>
              
              {cvRiskPercentage === null ? (
                <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
                  <Typography color="text.secondary" fontStyle="italic">
                    Important: Inputs must be complete to perform calculation
                  </Typography>
                  <Box sx={{ mt: 2, height: 40, bgcolor: '#e2e8f0', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h6" color="text.disabled">-- %</Typography>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Risk</Typography>
                  <Box sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: riskInfo?.color,
                    color: 'white',
                    px: 4,
                    py: 2,
                    borderRadius: 2,
                    minWidth: 150,
                    mb: 3
                  }}>
                    <Typography variant="h4" fontWeight="bold">{cvRiskPercentage}%</Typography>
                  </Box>

                  <Box sx={{ textAlign: 'left', bgcolor: '#f1f5f9', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Contributing Factors:</Typography>
                    <Stack spacing={0.5}>
                      <Typography variant="caption">• Age: {data.cvRisk.age} years</Typography>
                      <Typography variant="caption">• Sex: {data.cvRisk.sex}</Typography>
                      <Typography variant="caption">• Smoking Status: {data.cvRisk.isSmoker}</Typography>
                      <Typography variant="caption">• BMI: {data.cvRisk.bmi} kg/m²</Typography>
                      <Typography variant="caption">• SBP: {data.cvRisk.sbp} mmHg</Typography>
                      <Typography variant="caption">• Diabetes: {data.cvRisk.diabetes}</Typography>
                      <Typography variant="caption">• On BP Medication: {data.cvRisk.onBPMedication}</Typography>
                    </Stack>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="caption" display="block" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      Aligned with WHO South Asia Non-laboratory based risk chart. Risk Level: {riskInfo?.label}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Cardiovascular Risk - Lab Based (Age 40-74 only) */}
      {isCRAEligible && (
        <Accordion expanded={expanded === 'cvRiskLab'} onChange={handleChange('cvRiskLab')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          {renderAccordionHeader('cvRiskLab', 'Cardiovascular Risk - Lab Based', 'cvRiskLab')}
          <AccordionDetails sx={{ bgcolor: 'white' }}>
            {renderSectionControls('cvRiskLab')}
            
            <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
              CRA (LAB)
            </Typography>

            <Grid container spacing={3} sx={{ opacity: editModes['cvRiskLab'] ? 1 : 0.6 }}>
              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Age</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRiskLab.age}
                  disabled
                  helperText="Between : 40-74"
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Sex</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRiskLab.sex}
                    disabled={!editModes['cvRiskLab']}
                    onChange={(e) => {
                      handleStartSection('cvRiskLab');
                      onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, sex: e.target.value } });
                    }}
                  >
                    <MenuItem value="Men">Men</MenuItem>
                    <MenuItem value="Women">Women</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>BMI</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRiskLab.bmi}
                  disabled={!editModes['cvRiskLab']}
                  onChange={(e) => {
                    handleStartSection('cvRiskLab');
                    onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, bmi: e.target.value } });
                  }}
                  placeholder="-- Select --"
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Cigarette Smoker</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRiskLab.isSmoker}
                    disabled={!editModes['cvRiskLab']}
                    onChange={(e) => {
                      handleStartSection('cvRiskLab');
                      onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, isSmoker: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Systolic Blood Pressure</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRiskLab.sbp}
                  disabled={!editModes['cvRiskLab']}
                  onChange={(e) => {
                    handleStartSection('cvRiskLab');
                    onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, sbp: e.target.value } });
                  }}
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>On Blood Pressure Medication</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRiskLab.onBPMedication}
                    disabled={!editModes['cvRiskLab']}
                    onChange={(e) => {
                      handleStartSection('cvRiskLab');
                      onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, onBPMedication: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Diabetes</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={data.cvRiskLab.diabetes}
                    disabled={!editModes['cvRiskLab']}
                    onChange={(e) => {
                      handleStartSection('cvRiskLab');
                      onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, diabetes: e.target.value } });
                    }}
                  >
                    <MenuItem value="No">No</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>Total Cholesterol In Mg/Dl</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRiskLab.totalCholesterol}
                  disabled={!editModes['cvRiskLab']}
                  onChange={(e) => {
                    handleStartSection('cvRiskLab');
                    onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, totalCholesterol: e.target.value } });
                  }}
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>HDL Cholesterol In Mg/Dl</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={data.cvRiskLab.hdlCholesterol}
                  disabled={!editModes['cvRiskLab']}
                  onChange={(e) => {
                    handleStartSection('cvRiskLab');
                    onChange({ ...data, cvRiskLab: { ...data.cvRiskLab, hdlCholesterol: e.target.value } });
                  }}
                />
              </Grid>
            </Grid>

            {/* Result Section */}
            <Box sx={{ mt: 4, pt: 3, borderTop: '2px solid #e2e8f0', textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Result</Typography>
              
              {cvRiskLabPercentage === null ? (
                <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
                  <Typography color="text.secondary" fontStyle="italic">
                    Important: Inputs must be complete to perform calculation
                  </Typography>
                  <Box sx={{ mt: 2, height: 40, bgcolor: '#e2e8f0', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h6" color="text.disabled">-- %</Typography>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Risk</Typography>
                  <Box sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: riskInfoLab?.color,
                    color: 'white',
                    px: 4,
                    py: 2,
                    borderRadius: 2,
                    minWidth: 150,
                    mb: 3
                  }}>
                    <Typography variant="h4" fontWeight="bold">{cvRiskLabPercentage}%</Typography>
                  </Box>

                  <Box sx={{ textAlign: 'left', bgcolor: '#f1f5f9', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Contributing Factors:</Typography>
                    <Stack spacing={0.5}>
                      <Typography variant="caption">• Age: {data.cvRiskLab.age} years</Typography>
                      <Typography variant="caption">• Sex: {data.cvRiskLab.sex}</Typography>
                      <Typography variant="caption">• Smoking Status: {data.cvRiskLab.isSmoker}</Typography>
                      <Typography variant="caption">• SBP: {data.cvRiskLab.sbp} mmHg</Typography>
                      <Typography variant="caption">• Diabetes: {data.cvRiskLab.diabetes}</Typography>
                      <Typography variant="caption">• Total Cholesterol: {data.cvRiskLab.totalCholesterol} mg/dL</Typography>
                      <Typography variant="caption">• HDL Cholesterol: {data.cvRiskLab.hdlCholesterol} mg/dL</Typography>
                      <Typography variant="caption">• On BP Medication: {data.cvRiskLab.onBPMedication}</Typography>
                    </Stack>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="caption" display="block" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      Aligned with WHO South Asia Laboratory-based risk chart. Risk Level: {riskInfoLab?.label}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default ClinicalAssessmentPanel;
