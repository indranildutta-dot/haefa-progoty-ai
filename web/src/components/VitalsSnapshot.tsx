import React from 'react';
import { Box, Typography, Paper, Divider, Chip, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
import { VitalsRecord, Patient, LabReportRecord } from '../types';

interface VitalsSnapshotProps {
  vitals: VitalsRecord | null;
  gender?: string;
  labReports?: LabReportRecord[];
}

const formatFieldKey = (key: string): string => {
  const map: Record<string, string> = {
    hemoglobin: 'Hb',
    wbc: 'WBC',
    rbc: 'RBC',
    platelets: 'Plt',
    hematocrit: 'Hct',
    mcv: 'MCV',
    mch: 'MCH',
    mchc: 'MCHC',
    bilirubin_total: 'Total Bili',
    bilirubin_direct: 'Direct Bili',
    sgot_ast: 'AST',
    sgpt_alt: 'ALT',
    alk_phos: 'ALP',
    total_protein: 'Protein',
    albumin: 'Albumin',
    urea: 'Urea',
    creatinine: 'Creat',
    egfr: 'eGFR',
    sodium: 'Na+',
    potassium: 'K+',
    chloride: 'Cl-',
    total_cholesterol: 'Cholesterol',
    hdl_cholesterol: 'HDL',
    ldl_cholesterol: 'LDL',
    triglycerides: 'TG',
    appearance: 'Appearance',
    ph: 'pH',
    specific_gravity: 'Sp.Gr',
    protein: 'Prot',
    sugar: 'Sugar',
    pus_cells: 'Pus',
    rbc_cells: 'RBC',
    epithelial: 'Epithel',
    fbg: 'FBG',
    rbg: 'RBG',
    afb_smear: 'AFB',
    genexpert_mtb: 'MTB',
    genexpert_rif: 'Rif',
    rhythm: 'Rhythm',
    heart_rate: 'HR',
    axis_deviation: 'Axis',
    impression: 'Impression',
    findings_details: 'Details'
  };
  return map[key] || key;
};

const VitalsSnapshot: React.FC<VitalsSnapshotProps> = ({ vitals, gender, labReports = [] }) => {
  if (!vitals) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="textSecondary" align="center">No data recorded for this visit.</Typography>
      </Paper>
    );
  }

  const renderSection = (title: string, items: { label: string; value: any; color?: string; abnormal?: boolean }[]) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
        {title}
      </Typography>
      <Grid container spacing={1}>
        {items.map((item, idx) => (
          <Grid size={6} key={idx}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 1, 
              bgcolor: 'white', 
              border: '1px solid', 
              borderColor: item.abnormal ? 'error.main' : '#e2e8f0',
              height: '100%'
            }}>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ fontSize: '0.65rem' }}>{item.label}</Typography>
              <Typography variant="body2" fontWeight="bold" color={item.abnormal ? 'error.main' : (item.color || 'text.primary')} sx={{ fontSize: '0.8rem' }}>
                {item.value || '--'}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const hasSecondBP = vitals.systolic_2 !== undefined && vitals.systolic_2 !== null && !isNaN(vitals.systolic_2) && vitals.systolic_2 > 0 &&
                      vitals.diastolic_2 !== undefined && vitals.diastolic_2 !== null && !isNaN(vitals.diastolic_2) && vitals.diastolic_2 > 0;
  const sysVal = hasSecondBP ? vitals.systolic_2 : vitals.systolic;
  const diaVal = hasSecondBP ? vitals.diastolic_2 : vitals.diastolic;

  const isAbnormalTemp = vitals.temperature && (vitals.temperature >= 38.0 || vitals.temperature < 37.0);
  const isAbnormalHR = vitals.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 60);
  const isAbnormalBP = sysVal && diaVal && (sysVal > 129 || sysVal < 110 || diaVal >= 80 || diaVal < 60);
  const isAbnormalO2 = vitals.oxygenSaturation && !isNaN(vitals.oxygenSaturation) && vitals.oxygenSaturation > 0 && vitals.oxygenSaturation < 93;

  const getGlucoseStatus = (type: 'fbg' | 'rbg', val: number) => {
    if (type === 'fbg') {
      if (val >= 126) return { label: 'DIABETES RANGE', color: 'error.main' };
      if (val >= 100) return { label: 'PREDIABETES', color: 'warning.main' };
      if (val < 55) return { label: 'SEVERE HYPOGLYCEMIA', color: 'error.main' };
      if (val < 70) return { label: 'HYPOGLYCEMIA', color: 'warning.main' };
      return { label: 'NORMAL', color: 'success.main' };
    } else {
      if (val >= 200) return { label: 'CRITICAL ALERT', color: 'error.main' };
      if (val >= 140) return { label: 'ELEVATED', color: 'warning.main' };
      if (val < 55) return { label: 'SEVERE HYPOGLYCEMIA', color: 'error.main' };
      if (val < 70) return { label: 'HYPOGLYCEMIA', color: 'warning.main' };
      return { label: 'NORMAL', color: 'success.main' };
    }
  };

  const getHbStatus = (val: number) => {
    const isMale = gender?.toLowerCase() === 'male';
    const isPregnant = !!vitals?.is_pregnant;
    if (isMale) {
      if (val > 17.5) return { label: 'URGENT (HIGH HB)', color: 'warning.main' };
      if (val < 7.0) return { label: 'SEVERE ANEMIA', color: 'error.main' };
      if (val < 10.0) return { label: 'MODERATE ANEMIA', color: 'warning.main' };
      if (val < 13.0) return { label: 'MILD ANEMIA', color: 'warning.main' };
      return { label: 'NORMAL', color: 'success.main' };
    } else {
      const lowerLimitNormal = isPregnant ? 11.0 : 12.0;
      if (val > 15.5) return { label: 'URGENT (HIGH HB)', color: 'warning.main' };
      if (val < 7.0) return { label: 'SEVERE ANEMIA', color: 'error.main' };
      if (val < 10.0) return { label: 'MODERATE ANEMIA', color: 'warning.main' };
      if (val < lowerLimitNormal) return { label: 'MILD ANEMIA', color: 'warning.main' };
      return { label: 'NORMAL', color: 'success.main' };
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, mb: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
      <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 3, borderBottom: '2px solid', pb: 1 }}>
        STATION DATA SUMMARY
      </Typography>

      {renderSection('Body Measures', [
        { label: 'Weight', value: vitals.weight ? `${vitals.weight} kg` : null },
        { label: 'Height', value: vitals.height ? `${vitals.height} cm` : null },
        { label: 'BMI', value: vitals.bmi ? `${vitals.bmi} (${vitals.bmi_class})` : null, abnormal: vitals.bmi_class === 'Obese' || vitals.bmi_class === 'Overweight' || vitals.bmi_class === 'Underweight' },
        { label: 'MUAC', value: vitals.muac ? `${vitals.muac} (${vitals.muac_class})` : null, abnormal: vitals.muac_class !== 'Normal' && !!vitals.muac_class },
      ])}

      {renderSection('Vital Signs', [
        { label: 'BP (1st)', value: vitals.systolic ? `${vitals.systolic}/${vitals.diastolic}` : null, abnormal: isAbnormalBP },
        { label: 'BP (2nd)', value: vitals.systolic_2 ? `${vitals.systolic_2}/${vitals.diastolic_2}` : null },
        { label: 'Heart Rate', value: vitals.heartRate ? `${vitals.heartRate} bpm` : null, abnormal: isAbnormalHR },
        { label: 'Temp', value: vitals.temperature ? `${vitals.temperature}°C` : null, abnormal: isAbnormalTemp },
        { label: 'SpO2', value: vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : null, abnormal: isAbnormalO2 },
        { label: 'Resp Rate', value: vitals.respiratoryRate ? `${vitals.respiratoryRate}/min` : null },
      ])}

      {renderSection('Labs & Risks', [
        { label: 'Blood Group', value: vitals.blood_group, color: 'error.main' },
        { label: 'FBG', value: vitals.fbg ? `${vitals.fbg} mg/dL (${getGlucoseStatus('fbg', vitals.fbg).label})` : null, color: vitals.fbg ? getGlucoseStatus('fbg', vitals.fbg).color : undefined },
        { label: 'RBG', value: vitals.rbg ? `${vitals.rbg} mg/dL (${getGlucoseStatus('rbg', vitals.rbg).label})` : null, color: vitals.rbg ? getGlucoseStatus('rbg', vitals.rbg).color : undefined },
        { label: 'Hemoglobin', value: vitals.hemoglobin ? `${vitals.hemoglobin} g/dL (${getHbStatus(vitals.hemoglobin).label})` : null, color: vitals.hemoglobin ? getHbStatus(vitals.hemoglobin).color : undefined },
        { label: 'Pregnant', value: vitals.is_pregnant ? `Yes (${vitals.pregnancy_months}m)` : 'No' },
        { label: 'Allergies', 
          value: Array.isArray(vitals.allergies) ? (vitals.allergies.length ? vitals.allergies.join(', ') : 'None') : (vitals.allergies || 'None'), 
          color: (Array.isArray(vitals.allergies) ? vitals.allergies.some(a => String(a).trim().toLowerCase() !== 'none') : (String(vitals.allergies || '').trim().toLowerCase() !== 'none' && String(vitals.allergies || '').trim() !== '')) ? 'error.main' : undefined 
        },
      ])}

      {labReports && labReports.length > 0 && (
        <Box sx={{ mb: 2, mt: 1 }}>
          <Typography variant="caption" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
            RETURNED LAB REPORTS ({labReports.length})
          </Typography>
          <Stack spacing={1.5}>
            {labReports.map((report, rIdx) => (
              <Box key={report.id || rIdx} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'white', border: '1px solid #cbd5e1' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" fontWeight="950" sx={{ color: 'primary.main', fontSize: '0.72rem' }}>
                    {report.test_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.62rem', fontWeight: 'bold' }}>
                    {report.reported_at}
                  </Typography>
                </Stack>
                <Grid container spacing={1}>
                  {Object.entries(report.fields || {}).map(([key, val]) => {
                    if (val === undefined || val === null || val === '') return null;
                    return (
                      <Grid size={6} key={key}>
                        <Box sx={{ borderBottom: '1px dashed #e2e8f0', pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                            {formatFieldKey(key)}:
                          </Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.68rem', color: 'text.primary' }}>
                            {typeof val === 'number' ? val.toString() : String(val)}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
                {report.remarks && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic', fontSize: '0.64rem', color: 'text.secondary', borderTop: '1px solid #f1f5f9', pt: 0.5 }}>
                    Ref notes: {report.remarks}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
};

export default VitalsSnapshot;
