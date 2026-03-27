import React, { useState } from 'react';
import { 
  Box, Typography, Accordion, AccordionSummary, AccordionDetails, 
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
  Switch, TextField, IconButton, Button, Grid, Rating, Checkbox,
  FormGroup
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import EditIcon from '@mui/icons-material/Edit';

export interface ClinicalAssessmentData {
  complaints: { date: string; description: string; duration: string }[];
  tbScreening: Record<string, string>;
  physicalExamGeneral: {
    anemia: number;
    jaundice: number;
    edema: number;
    lymphNodesPalpable: boolean;
    heartNAD: boolean;
    lungsNAD: boolean;
  };
  physicalExamSystemic: string;
  currentRx: string;
  patientHistory: Record<string, string>;
  familyHistory: Record<string, string>;
  vaccination: Record<string, { received: string; givenByNirog: boolean }>;
  socialHistory: Record<string, string>;
  wellbeing: Record<string, string>;
}

export const initialClinicalAssessment: ClinicalAssessmentData = {
  complaints: [],
  tbScreening: {},
  physicalExamGeneral: {
    anemia: 0,
    jaundice: 0,
    edema: 0,
    lymphNodesPalpable: false,
    heartNAD: false,
    lungsNAD: false,
  },
  physicalExamSystemic: '',
  currentRx: '',
  patientHistory: {},
  familyHistory: {},
  vaccination: {},
  socialHistory: {},
  wellbeing: {
    signsOfMentalIllness: 'No'
  }
};

interface Props {
  data: ClinicalAssessmentData;
  onChange: (data: ClinicalAssessmentData) => void;
}

const ClinicalAssessmentPanel: React.FC<Props> = ({ data, onChange }) => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const getStatus = (section: keyof ClinicalAssessmentData) => {
    // Simple logic to determine if section is completed or in progress
    if (section === 'complaints') return data.complaints.length > 0 ? 'Completed' : 'In Progress';
    if (section === 'tbScreening') return Object.keys(data.tbScreening).length > 0 ? 'Completed' : 'In Progress';
    if (section === 'physicalExamGeneral') return 'Completed'; // Always completed for simplicity or add logic
    if (section === 'patientHistory') return Object.keys(data.patientHistory).length > 0 ? 'Completed' : 'In Progress';
    if (section === 'familyHistory') return Object.keys(data.familyHistory).length > 0 ? 'Completed' : 'In Progress';
    if (section === 'socialHistory') return Object.keys(data.socialHistory).length > 0 ? 'Completed' : 'In Progress';
    if (section === 'vaccination') return Object.keys(data.vaccination).length > 0 ? 'Completed' : 'In Progress';
    if (section === 'wellbeing') return Object.keys(data.wellbeing).length > 1 ? 'Completed' : 'In Progress';
    return 'Completed';
  };

  const renderAccordionHeader = (id: string, title: string, section: keyof ClinicalAssessmentData) => (
    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.200', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <Typography fontWeight="bold" color="text.secondary">{title}</Typography>
        <Typography variant="caption" color={getStatus(section) === 'Completed' ? 'success.main' : 'text.secondary'} fontWeight="bold">
          {getStatus(section)}
        </Typography>
      </Box>
    </AccordionSummary>
  );

  const handleRadioChange = (section: keyof ClinicalAssessmentData, field: string, value: string) => {
    onChange({
      ...data,
      [section]: {
        ...(data[section] as any),
        [field]: value
      }
    });
  };

  const renderYesNoGroup = (section: keyof ClinicalAssessmentData, field: string, label: string) => (
    <Box key={`${section}-${field}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1 }}>
      <Typography>{label}</Typography>
      <RadioGroup row value={(data[section] as any)[field] || ''} onChange={(e) => handleRadioChange(section, field, e.target.value)}>
        <FormControlLabel value="No" control={<Radio />} label="No" sx={{ minHeight: '44px', mr: 2 }} />
        <FormControlLabel value="Yes" control={<Radio />} label="Yes" sx={{ minHeight: '44px' }} />
      </RadioGroup>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Complaints */}
      <Accordion expanded={expanded === 'complaints'} onChange={handleChange('complaints')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('complaints', 'Complaints', 'complaints')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <IconButton color="success" onClick={() => {
              onChange({ ...data, complaints: [...data.complaints, { date: new Date().toISOString().split('T')[0], description: '', duration: '' }] });
            }}>
              <AddCircleIcon fontSize="large" />
            </IconButton>
          </Box>
          {data.complaints.map((complaint, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'white', p: 1.5, borderRadius: 5, mb: 1 }}>
              <TextField type="date" value={complaint.date} onChange={(e) => {
                const newComplaints = [...data.complaints];
                newComplaints[index].date = e.target.value;
                onChange({ ...data, complaints: newComplaints });
              }} slotProps={{ htmlInput: { style: { minHeight: '44px' } } }} />
              <TextField fullWidth placeholder="Complaint description" value={complaint.description} onChange={(e) => {
                const newComplaints = [...data.complaints];
                newComplaints[index].description = e.target.value;
                onChange({ ...data, complaints: newComplaints });
              }} slotProps={{ htmlInput: { style: { minHeight: '44px' } } }} />
              <TextField placeholder="Duration" value={complaint.duration} onChange={(e) => {
                const newComplaints = [...data.complaints];
                newComplaints[index].duration = e.target.value;
                onChange({ ...data, complaints: newComplaints });
              }} slotProps={{ htmlInput: { style: { minHeight: '44px' } } }} />
              <IconButton color="error" onClick={() => {
                const newComplaints = data.complaints.filter((_, i) => i !== index);
                onChange({ ...data, complaints: newComplaints });
              }}>
                <RemoveCircleIcon fontSize="large" />
              </IconButton>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* TB Screening */}
      <Accordion expanded={expanded === 'tbScreening'} onChange={handleChange('tbScreening')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('tbScreening', 'TB Screening', 'tbScreening')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          {renderYesNoGroup('tbScreening', 'cough', 'Cough > 3 Weeks?')}
          {renderYesNoGroup('tbScreening', 'lgerf', 'LGERF?')}
          {renderYesNoGroup('tbScreening', 'nightSweat', 'Night sweat?')}
          {renderYesNoGroup('tbScreening', 'weightLoss', 'Weight loss?')}
        </AccordionDetails>
      </Accordion>

      {/* Physical Examination - General */}
      <Accordion expanded={expanded === 'physicalExamGeneral'} onChange={handleChange('physicalExamGeneral')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('physicalExamGeneral', 'Physical Examination - General', 'physicalExamGeneral')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1 }}>
            <Typography>Anemia</Typography>
            <Rating max={3} value={data.physicalExamGeneral.anemia} onChange={(_, newValue) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, anemia: newValue || 0 } })} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1 }}>
            <Typography>Jaundice</Typography>
            <Rating max={3} value={data.physicalExamGeneral.jaundice} onChange={(_, newValue) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, jaundice: newValue || 0 } })} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1 }}>
            <Typography>Edema</Typography>
            <Rating max={3} value={data.physicalExamGeneral.edema} onChange={(_, newValue) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, edema: newValue || 0 } })} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
            <Typography>Lymph Nodes with Palpable</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.lymphNodesPalpable ? 'YES' : 'NO'}</Typography>
              <Switch checked={data.physicalExamGeneral.lymphNodesPalpable} onChange={(e) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, lymphNodesPalpable: e.target.checked } })} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
            <Typography>Heart with NAD</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.heartNAD ? 'YES' : 'NO'}</Typography>
              <Switch checked={data.physicalExamGeneral.heartNAD} onChange={(e) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, heartNAD: e.target.checked } })} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
            <Typography>Lungs with NAD</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.physicalExamGeneral.lungsNAD ? 'YES' : 'NO'}</Typography>
              <Switch checked={data.physicalExamGeneral.lungsNAD} onChange={(e) => onChange({ ...data, physicalExamGeneral: { ...data.physicalExamGeneral, lungsNAD: e.target.checked } })} />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Physical Examination - Systemic */}
      <Accordion expanded={expanded === 'physicalExamSystemic'} onChange={handleChange('physicalExamSystemic')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('physicalExamSystemic', 'Physical Examination - Systemic', 'physicalExamSystemic')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <TextField fullWidth multiline rows={4} placeholder="Enter systemic physical examination details..." value={data.physicalExamSystemic} onChange={(e) => onChange({ ...data, physicalExamSystemic: e.target.value })} slotProps={{ htmlInput: { style: { minHeight: '44px' } } }} />
        </AccordionDetails>
      </Accordion>

      {/* Current Rx taken */}
      <Accordion expanded={expanded === 'currentRx'} onChange={handleChange('currentRx')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('currentRx', 'Current Rx taken', 'currentRx')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <TextField fullWidth multiline rows={4} placeholder="Enter current medications..." value={data.currentRx} onChange={(e) => onChange({ ...data, currentRx: e.target.value })} slotProps={{ htmlInput: { style: { minHeight: '44px' } } }} />
        </AccordionDetails>
      </Accordion>

      {/* Patient H/O illness */}
      <Accordion expanded={expanded === 'patientHistory'} onChange={handleChange('patientHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('patientHistory', 'Patient H/O illness', 'patientHistory')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you have any of the following diseases?</Typography>
          {['Hypertension', 'Diabetes', 'Asthma', 'TB', 'Typhoid', 'Malaria', 'Hepatitis', 'Dengue', 'Fracture/injury', 'Skin disease', 'IHD', 'Stroke', 'Surgery'].map((illness) => (
            renderYesNoGroup('patientHistory', illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Family H/O illness */}
      <Accordion expanded={expanded === 'familyHistory'} onChange={handleChange('familyHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('familyHistory', 'Family H/O illness', 'familyHistory')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Does your family have any of the following diseases?</Typography>
          {['Hypertension', 'Diabetes', 'Asthma', 'TB', 'Typhoid', 'Malaria', 'Hepatitis', 'Dengue', 'Fracture/injury', 'Skin disease', 'Cancer', 'IHD', 'Stroke'].map((illness) => (
            renderYesNoGroup('familyHistory', illness, illness)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Vaccination */}
      <Accordion expanded={expanded === 'vaccination'} onChange={handleChange('vaccination')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('vaccination', 'Vaccination', 'vaccination')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid size={6}><Typography variant="subtitle2">Did you get the following vaccinations?</Typography></Grid>
            <Grid size={6} sx={{ textAlign: 'right' }}><Typography variant="caption">Given by Nirog Team?</Typography></Grid>
          </Grid>
          {['BCG', 'Pentavalent', 'OPV', 'PCV', 'IPV', 'MR', 'Cholera: Dose-1', 'Cholera: Dose-2', 'Cholera: Dose-3', 'Measles', 'TT', 'Rubella'].map((vax) => (
            <Box key={vax} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 1 }}>
              <Typography sx={{ width: '30%' }}>{vax}</Typography>
              <RadioGroup row value={data.vaccination[vax]?.received || ''} onChange={(e) => onChange({ ...data, vaccination: { ...data.vaccination, [vax]: { ...data.vaccination[vax], received: e.target.value } } })}>
                <FormControlLabel value="No" control={<Radio />} label="No" sx={{ minHeight: '44px', mr: 2 }} />
                <FormControlLabel value="Yes" control={<Radio />} label="Yes" sx={{ minHeight: '44px' }} />
              </RadioGroup>
              <Checkbox checked={data.vaccination[vax]?.givenByNirog || false} onChange={(e) => onChange({ ...data, vaccination: { ...data.vaccination, [vax]: { ...data.vaccination[vax], givenByNirog: e.target.checked } } })} sx={{ p: 1.5 }} />
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient Social H/O */}
      <Accordion expanded={expanded === 'socialHistory'} onChange={handleChange('socialHistory')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('socialHistory', 'Patient Social H/O', 'socialHistory')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Do you take any of the following?</Typography>
          {['Alcohol', 'Drugs', 'Smoking', 'Betel Nuts', 'Chewing tobacco', 'Other'].map((item) => (
            renderYesNoGroup('socialHistory', item, item)
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Patient Wellbeing */}
      <Accordion expanded={expanded === 'wellbeing'} onChange={handleChange('wellbeing')} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {renderAccordionHeader('wellbeing', 'Patient Wellbeing', 'wellbeing')}
        <AccordionDetails sx={{ bgcolor: 'grey.100' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography>Any sign of mental illness, stress or depression?</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ mr: 1 }}>{data.wellbeing.signsOfMentalIllness}</Typography>
              <Switch checked={data.wellbeing.signsOfMentalIllness === 'Yes'} onChange={(e) => onChange({ ...data, wellbeing: { ...data.wellbeing, signsOfMentalIllness: e.target.checked ? 'Yes' : 'No' } })} />
            </Box>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>1. Have you been a happy person?</Typography>
          <RadioGroup row value={data.wellbeing.happyPerson || ''} onChange={(e) => handleRadioChange('wellbeing', 'happyPerson', e.target.value)}>
            <FormControlLabel value="Always" control={<Radio />} label="Always" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Sometime" control={<Radio />} label="Sometime" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Never" control={<Radio />} label="Never" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>2. Do you feel nervous/tense?</Typography>
          <RadioGroup row value={data.wellbeing.nervousTense || ''} onChange={(e) => handleRadioChange('wellbeing', 'nervousTense', e.target.value)}>
            <FormControlLabel value="Always" control={<Radio />} label="Always" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Sometime" control={<Radio />} label="Sometime" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Never" control={<Radio />} label="Never" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>3. Do you feel sad/downhearted?</Typography>
          <RadioGroup row value={data.wellbeing.sadDownhearted || ''} onChange={(e) => handleRadioChange('wellbeing', 'sadDownhearted', e.target.value)}>
            <FormControlLabel value="Always" control={<Radio />} label="Always" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Sometime" control={<Radio />} label="Sometime" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Never" control={<Radio />} label="Never" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>4. In the past 1 month, have you visited family/friends?</Typography>
          <RadioGroup row value={data.wellbeing.visitedFamilyFriends || ''} onChange={(e) => handleRadioChange('wellbeing', 'visitedFamilyFriends', e.target.value)}>
            <FormControlLabel value="Yes" control={<Radio />} label="Yes" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="No" control={<Radio />} label="No" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>5. In the past 1 month, have your mental state negatively affected your work/productivity?</Typography>
          <RadioGroup row value={data.wellbeing.mentalStateAffectedWork || ''} onChange={(e) => handleRadioChange('wellbeing', 'mentalStateAffectedWork', e.target.value)}>
            <FormControlLabel value="Yes" control={<Radio />} label="Yes" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="No" control={<Radio />} label="No" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>6. How do you feel about your health?</Typography>
          <RadioGroup row value={data.wellbeing.healthFeeling || ''} onChange={(e) => handleRadioChange('wellbeing', 'healthFeeling', e.target.value)}>
            <FormControlLabel value="Excellent" control={<Radio />} label="Excellent" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Good" control={<Radio />} label="Good" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Fair" control={<Radio />} label="Fair" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Poor" control={<Radio />} label="Poor" sx={{ minHeight: '44px' }} />
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>7. Compared to 1 year ago, your general health is</Typography>
          <RadioGroup row value={data.wellbeing.healthComparedToLastYear || ''} onChange={(e) => handleRadioChange('wellbeing', 'healthComparedToLastYear', e.target.value)}>
            <FormControlLabel value="Better" control={<Radio />} label="Better" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Same" control={<Radio />} label="Same" sx={{ minHeight: '44px', mr: 2 }} />
            <FormControlLabel value="Worse" control={<Radio />} label="Worse" sx={{ minHeight: '44px' }} />
          </RadioGroup>

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
            <Box key={item.id} sx={{ mb: 2 }}>
              <Typography variant="subtitle2">{item.label}</Typography>
              <RadioGroup row value={data.wellbeing[item.id] || ''} onChange={(e) => handleRadioChange('wellbeing', item.id, e.target.value)}>
                <FormControlLabel value="Limited a lot" control={<Radio />} label="Limited a lot" sx={{ minHeight: '44px', mr: 2 }} />
                <FormControlLabel value="Limited a little" control={<Radio />} label="Limited a little" sx={{ minHeight: '44px', mr: 2 }} />
                <FormControlLabel value="Not limited" control={<Radio />} label="Not limited" sx={{ minHeight: '44px' }} />
              </RadioGroup>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ClinicalAssessmentPanel;
