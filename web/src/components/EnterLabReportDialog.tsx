import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, 
  Typography, Box, Grid, Autocomplete, MenuItem, InputAdornment, 
  Card, CardContent, Stack, CircularProgress, Divider, Alert
} from '@mui/material';
import { 
  Science as LabIcon, 
  Save as SaveIcon, 
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { saveLabReport } from '../services/encounterService';
import { LabReportRecord } from '../types';

interface EnterLabReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  patientId: string;
  encounterId: string;
  patientName: string;
}

const COMMON_LABS = [
  'Complete Blood Count (CBC)',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'Lipid Profile',
  'Urine Routine',
  'Blood Sugar (Fasting)',
  'Blood Sugar (Random)',
  'X-Ray Chest',
  'ECG',
  'Ultrasound Abdomen',
  'Sputum Test'
];

interface FieldConfig {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  unit?: string;
  placeholder?: string;
  options?: string[];
  minNormal?: number;
  maxNormal?: number;
}

const LAB_FIELD_CONFIGS: Record<string, FieldConfig[]> = {
  'Complete Blood Count (CBC)': [
    { key: 'hemoglobin', label: 'Hemoglobin', type: 'number', unit: 'g/dL', placeholder: 'e.g. 13.5', minNormal: 12.0, maxNormal: 17.5 },
    { key: 'wbc', label: 'White Blood Cell (WBC)', type: 'number', unit: 'cells/µL', placeholder: 'e.g. 7000', minNormal: 4000, maxNormal: 11000 },
    { key: 'rbc', label: 'Red Blood Cell (RBC)', type: 'number', unit: 'million/µL', placeholder: 'e.g. 4.8', minNormal: 4.2, maxNormal: 5.9 },
    { key: 'platelets', label: 'Platelet Count', type: 'number', unit: 'cells/µL', placeholder: 'e.g. 250000', minNormal: 150000, maxNormal: 450000 },
    { key: 'hematocrit', label: 'Hematocrit (PCV)', type: 'number', unit: '%', placeholder: 'e.g. 42', minNormal: 36, maxNormal: 50 },
    { key: 'mcv', label: 'MCV', type: 'number', unit: 'fL', placeholder: 'e.g. 90', minNormal: 80, maxNormal: 100 },
    { key: 'mch', label: 'MCH', type: 'number', unit: 'pg', placeholder: 'e.g. 30', minNormal: 27, maxNormal: 33 },
    { key: 'mchc', label: 'MCHC', type: 'number', unit: 'g/dL', placeholder: 'e.g. 33', minNormal: 32, maxNormal: 36 }
  ],
  'Liver Function Test (LFT)': [
    { key: 'bilirubin_total', label: 'Total Bilirubin', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 0.8', minNormal: 0.1, maxNormal: 1.2 },
    { key: 'bilirubin_direct', label: 'Direct Bilirubin', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 0.2', minNormal: 0.0, maxNormal: 0.3 },
    { key: 'sgot_ast', label: 'SGOT (AST)', type: 'number', unit: 'U/L', placeholder: 'e.g. 25', minNormal: 5, maxNormal: 40 },
    { key: 'sgpt_alt', label: 'SGPT (ALT)', type: 'number', unit: 'U/L', placeholder: 'e.g. 30', minNormal: 5, maxNormal: 35 },
    { key: 'alk_phos', label: 'Alkaline Phosphatase (ALP)', type: 'number', unit: 'U/L', placeholder: 'e.g. 75', minNormal: 30, maxNormal: 120 },
    { key: 'total_protein', label: 'Total Protein', type: 'number', unit: 'g/dL', placeholder: 'e.g. 7.2', minNormal: 6.0, maxNormal: 8.3 },
    { key: 'albumin', label: 'Albumin', type: 'number', unit: 'g/dL', placeholder: 'e.g. 4.2', minNormal: 3.5, maxNormal: 5.0 }
  ],
  'Kidney Function Test (KFT)': [
    { key: 'urea', label: 'Blood Urea', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 25', minNormal: 15, maxNormal: 40 },
    { key: 'creatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 0.9', minNormal: 0.6, maxNormal: 1.3 },
    { key: 'egfr', label: 'eGFR', type: 'number', unit: 'mL/min/1.73m²', placeholder: 'e.g. 95', minNormal: 90, maxNormal: 200 },
    { key: 'sodium', label: 'Serum Sodium (Na+)', type: 'number', unit: 'mmol/L', placeholder: 'e.g. 140', minNormal: 135, maxNormal: 145 },
    { key: 'potassium', label: 'Serum Potassium (K+)', type: 'number', unit: 'mmol/L', placeholder: 'e.g. 4.1', minNormal: 3.5, maxNormal: 5.0 },
    { key: 'chloride', label: 'Serum Chloride (Cl-)', type: 'number', unit: 'mmol/L', placeholder: 'e.g. 101', minNormal: 96, maxNormal: 106 }
  ],
  'Lipid Profile': [
    { key: 'total_cholesterol', label: 'Total Cholesterol', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 190', minNormal: 100, maxNormal: 200 },
    { key: 'hdl_cholesterol', label: 'HDL Cholesterol', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 45', minNormal: 40, maxNormal: 80 },
    { key: 'ldl_cholesterol', label: 'LDL Cholesterol', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 95', minNormal: 50, maxNormal: 100 },
    { key: 'triglycerides', label: 'Triglycerides', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 130', minNormal: 50, maxNormal: 150 }
  ],
  'Urine Routine': [
    { key: 'appearance', label: 'Appearance', type: 'select', options: ['Pale Yellow', 'Amber', 'Straw', 'Turbid', 'Bloody'] },
    { key: 'ph', label: 'pH', type: 'number', placeholder: 'e.g. 6.0', minNormal: 4.5, maxNormal: 8.0 },
    { key: 'specific_gravity', label: 'Specific Gravity', type: 'number', placeholder: 'e.g. 1.015', minNormal: 1.005, maxNormal: 1.030 },
    { key: 'protein', label: 'Urine Protein', type: 'select', options: ['Nil', 'Trace', '1+', '2+', '3+', '4+'] },
    { key: 'sugar', label: 'Urine Glucose', type: 'select', options: ['Nil', 'Trace', '1+', '2+', '3+', '4+'] },
    { key: 'pus_cells', label: 'Pus Cells / Leukocytes', type: 'number', unit: '/hpf', placeholder: 'e.g. 2', minNormal: 0, maxNormal: 5 },
    { key: 'rbc_cells', label: 'RBC Cells', type: 'number', unit: '/hpf', placeholder: 'e.g. 1', minNormal: 0, maxNormal: 2 },
    { key: 'epithelial', label: 'Epithelial Cells', type: 'number', unit: '/hpf', placeholder: 'e.g. 3', minNormal: 0, maxNormal: 10 }
  ],
  'Blood Sugar (Fasting)': [
    { key: 'fbg', label: 'Fasting Blood Glucose', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 90', minNormal: 70, maxNormal: 100 }
  ],
  'Blood Sugar (Random)': [
    { key: 'rbg', label: 'Random Blood Glucose', type: 'number', unit: 'mg/dL', placeholder: 'e.g. 120', minNormal: 70, maxNormal: 140 }
  ],
  'Sputum Test': [
    { key: 'afb_smear', label: 'Sputum AFB Smear', type: 'select', options: ['Smear Positive', 'Smear Negative', 'Not Done'] },
    { key: 'genexpert_mtb', label: 'GeneXpert MTB', type: 'select', options: ['MTB Detected', 'MTB Not Detected', 'Not Done'] },
    { key: 'genexpert_rif', label: 'Rifampicin Resistance', type: 'select', options: ['Detected', 'Not Detected', 'Indeterminate', 'Not Done'] }
  ],
  'ECG': [
    { key: 'rhythm', label: 'Rhythm', type: 'select', options: ['Normal Sinus Rhythm', 'Arrhythmia'] },
    { key: 'heart_rate', label: 'Heart Rate', type: 'number', unit: 'bpm', placeholder: 'e.g. 75', minNormal: 60, maxNormal: 100 },
    { key: 'axis_deviation', label: 'ST-T / Axis Changes', type: 'select', options: ['Normal', 'ST Elevation', 'ST Depression', 'T Wave Inversion', 'Other'] }
  ],
  'X-Ray Chest': [
    { key: 'impression', label: 'Chest Impression', type: 'select', options: ['Normal', 'Pleural Effusion', 'Consolidation', 'Cavitation', 'Cardiomegaly', 'Other finding'] },
    { key: 'findings_details', label: 'Detailed Findings', type: 'text', placeholder: 'Describe findings...' }
  ],
  'Ultrasound Abdomen': [
    { key: 'impression', label: 'Abdominal Impression', type: 'select', options: ['Normal', 'Fatty Liver', 'Gallstones', 'Cyst', 'Splenomegaly', 'Nephrolithiasis', 'Ascites', 'Other'] },
    { key: 'findings_details', label: 'Detailed Ultrasound Findings', type: 'text', placeholder: 'Describe findings...' }
  ]
};

export const EnterLabReportDialog: React.FC<EnterLabReportDialogProps> = ({
  open,
  onClose,
  onSaveSuccess,
  patientId,
  encounterId,
  patientName
}) => {
  const { selectedClinic, selectedCountry, user, userProfile } = useAppStore();
  const [testName, setTestName] = useState<string>('');
  const [reportedAt, setReportedAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Clear fields on change of testName
  useEffect(() => {
    if (testName) {
      const config = LAB_FIELD_CONFIGS[testName] || [];
      const initialFields: Record<string, any> = {};
      config.forEach(f => {
        initialFields[f.key] = f.type === 'select' ? (f.options ? f.options[0] : '') : '';
      });
      setFields(initialFields);
    } else {
      setFields({});
    }
    setRemarks('');
    setErrorMessage('');
  }, [testName]);

  const handleFieldChange = (key: string, value: any) => {
    setFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const checkIsAbnormal = (fConfig: FieldConfig, value: any): boolean => {
    if (value === '' || value === undefined || value === null) return false;
    if (fConfig.type === 'number') {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return false;
      if (fConfig.minNormal !== undefined && numVal < fConfig.minNormal) return true;
      if (fConfig.maxNormal !== undefined && numVal > fConfig.maxNormal) return true;
    }
    if (fConfig.type === 'select') {
      const normVal = String(value).trim().toLowerCase();
      if (normVal === 'arrhythmia' || normVal === 'smear positive' || normVal === 'mtb detected' || normVal === 'detected' || normVal === 'indeterminate') return true;
      if (fConfig.key === 'impression' && normVal !== 'normal') return true;
      if (fConfig.key === 'axis_deviation' && normVal !== 'normal') return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!testName) {
      setErrorMessage('Please select a valid lab test category.');
      return;
    }
    if (!reportedAt) {
      setErrorMessage('Please provide the date of the laboratory report.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      // Cast fields properly (convert string numbers to float numbers)
      const sanitizedFields: Record<string, any> = {};
      const config = LAB_FIELD_CONFIGS[testName] || [];
      
      config.forEach(f => {
        const rawValue = fields[f.key];
        if (f.type === 'number' && rawValue !== '') {
          sanitizedFields[f.key] = parseFloat(rawValue);
        } else {
          sanitizedFields[f.key] = rawValue;
        }
      });

      const reportPayload: Omit<LabReportRecord, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: patientId,
        encounter_id: encounterId,
        clinic_id: selectedClinic?.id || '',
        country_id: selectedCountry?.id || '',
        test_name: testName,
        reported_at: reportedAt,
        recorded_by: user?.uid || '',
        recorded_by_name: userProfile?.name || user?.email || 'Clinician',
        fields: sanitizedFields,
        remarks: remarks || ''
      };

      await saveLabReport(reportPayload);
      onSaveSuccess();
      // Clear and close
      setTestName('');
      setRemarks('');
      onClose();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Failed to submit the laboratory report. Please check your inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentConfigs = LAB_FIELD_CONFIGS[testName] || [];

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 5,
          p: 1,
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <LabIcon color="primary" sx={{ fontSize: 30 }} />
        <Box>
          <Typography variant="h6" fontWeight="950" color="text.primary">
            RECORD LAB TEST RESULTS
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Patient: <strong style={{ color: '#1e293b' }}>{patientName}</strong>
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ mt: 3 }}>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
            {errorMessage}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Metadata */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={COMMON_LABS}
              value={testName}
              onChange={(_, newValue) => setTestName(newValue || '')}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  required
                  label="Select Lab Test Category" 
                  variant="outlined" 
                  helperText="Choose the specific report you are typing in"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              required
              type="date"
              label="Date of Lab Report"
              value={reportedAt}
              onChange={(e) => setReportedAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Date as written on the printed laboratory sheet"
            />
          </Grid>

          {testName && (
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" sx={{ mb: 2.5, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Key Data Fields for: {testName}
              </Typography>

              <Grid container spacing={2.5}>
                {currentConfigs.map((fConfig) => {
                  const currentValue = fields[fConfig.key] || '';
                  const isAbnormal = checkIsAbnormal(fConfig, currentValue);

                  return (
                    <Grid size={{ xs: 12, sm: fConfig.type === 'text' ? 12 : 6, lg: fConfig.type === 'text' ? 12 : 4 }} key={fConfig.key}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          borderColor: isAbnormal ? 'error.light' : '#cbd5e1',
                          bgcolor: isAbnormal ? '#fef2f2' : 'white',
                          boxShadow: 'none',
                          borderRadius: 3,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: isAbnormal ? 'error.main' : 'primary.main',
                            bgcolor: isAbnormal ? '#fef2f2' : '#f8fafc'
                          }
                        }}
                      >
                        <CardContent sx={{ p: '16px !important' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: isAbnormal ? 'error.main' : 'text.secondary' }}>
                              {fConfig.label}
                            </Typography>
                            {isAbnormal && (
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main' }}>
                                <WarningIcon sx={{ fontSize: 13 }} />
                                <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                                  Out of Range
                                </Typography>
                              </Stack>
                            )}
                          </Stack>

                          {fConfig.type === 'select' ? (
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={currentValue}
                              onChange={(e) => handleFieldChange(fConfig.key, e.target.value)}
                            >
                              {fConfig.options?.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                  {opt}
                                </MenuItem>
                              ))}
                            </TextField>
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              type={fConfig.type}
                              placeholder={fConfig.placeholder}
                              value={currentValue}
                              onChange={(e) => handleFieldChange(fConfig.key, e.target.value)}
                              InputProps={{
                                endAdornment: fConfig.unit ? (
                                  <InputAdornment position="end">
                                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#64748b' }}>{fConfig.unit}</span>
                                  </InputAdornment>
                                ) : null,
                                sx: { fontWeight: 'bold' }
                              }}
                            />
                          )}

                          {fConfig.type === 'number' && (fConfig.minNormal !== undefined || fConfig.maxNormal !== undefined) && (
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary" style={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                Normal: {fConfig.minNormal} - {fConfig.maxNormal} {fConfig.unit}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>
          )}

          {testName && (
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="General Lab Remarks / Clinical Notes"
                placeholder="Type overall observations, reference lab number, clinical recommendations..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', gap: 1 }}>
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={onClose} 
          disabled={isSaving}
          startIcon={<CancelIcon />}
          sx={{ borderRadius: 3 }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSave} 
          disabled={isSaving || !testName}
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}
        >
          Save Lab Report
        </Button>
      </DialogActions>
    </Dialog>
  );
};
