import React, { useState } from 'react';
import { 
  Box, Typography, Button, Collapse, Paper, Grid, Stack, Divider, Chip 
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon, 
  Assignment as DiagnosisIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { DiagnosisRecord } from '../types';

interface ExpandableAssessmentDetailsProps {
  diagnosis: DiagnosisRecord;
}

export const ExpandableAssessmentDetails: React.FC<ExpandableAssessmentDetailsProps> = ({ diagnosis }) => {
  const [expanded, setExpanded] = useState(false);

  const assessment = diagnosis.assessment;

  // Render a key-value value checker that handles null or empty safely
  const renderValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '--';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return val.toString();
  };

  // Helper to check if any section data actually has content
  const hasContent = (obj: any) => {
    if (!obj) return false;
    if (Array.isArray(obj)) return obj.length > 0;
    if (typeof obj === 'object') {
      return Object.values(obj).some(v => v !== null && v !== undefined && v !== '');
    }
    return true;
  };

  return (
    <Box sx={{ mt: 1.5, width: '100%' }}>
      <Button
        variant="outlined"
        size="small"
        fullWidth
        onClick={() => setExpanded(!expanded)}
        endIcon={<ExpandMoreIcon sx={{ 
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: '0.2s'
        }} />}
        sx={{ 
          color: '#0369a1', 
          borderColor: '#bae6fd',
          fontWeight: 800,
          borderRadius: 2,
          textTransform: 'none',
          py: 0.8,
          '&:hover': {
            borderColor: '#0284c7',
            bgcolor: '#f0f9ff'
          }
        }}
      >
        {expanded ? "Hide Full Clinical Assessment" : "View Full Clinical Assessment"}
      </Button>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            mt: 1, 
            borderRadius: 3, 
            bgcolor: '#fafafa', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <Stack spacing={2}>
            {/* Section 2: Optional Additional Notes */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
                SECTION 2 — OPTIONAL ADDITIONAL NOTES
              </Typography>
              <Typography variant="body2" sx={{ bgcolor: '#f1f5f9', p: 1.5, borderRadius: 2, borderLeft: '3px solid #64748b', fontStyle: diagnosis.notes ? 'normal' : 'italic' }}>
                {diagnosis.notes || 'No optional notes provided.'}
              </Typography>
            </Box>

            {/* Section 3a & 3b: Provisional Diagnosis ICD-11 */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
                    SECTION 3A — PROVISIONAL DIAGNOSIS (ICD-11) (MAJOR)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {diagnosis.provisionalDiagnosisMajor && diagnosis.provisionalDiagnosisMajor.length > 0 ? (
                      diagnosis.provisionalDiagnosisMajor.map((icd, idx) => (
                        <Chip key={idx} label={icd} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>None</Typography>
                    )}
                  </Box>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
                    SECTION 3B — PROVISIONAL DIAGNOSIS (ICD-11) (MINOR)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {diagnosis.provisionalDiagnosisMinor && diagnosis.provisionalDiagnosisMinor.length > 0 ? (
                      diagnosis.provisionalDiagnosisMinor.map((icd, idx) => (
                        <Chip key={idx} label={icd} size="small" variant="outlined" color="primary" sx={{ fontWeight: 'bold' }} />
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>None</Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              SECTION 1 — REQUIRED CLINICAL ASSESSMENT DETAIL
            </Typography>

            {assessment ? (
              <Grid container spacing={2}>
                {/* 1. Complaints */}
                <Grid size={12}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      COMPLAINTS
                    </Typography>
                    {assessment.complaints && assessment.complaints.length > 0 ? (
                      <Stack spacing={1}>
                        {assessment.complaints.map((item: any, idx: number) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.8, bgcolor: '#f0f9ff', borderRadius: 1.5 }}>
                            <Typography variant="body2" fontWeight="bold" color="text.primary">
                              • {item.description}
                            </Typography>
                            <Chip 
                              label={`${item.duration} ${item.durationUnit || ''}`} 
                              size="small" 
                              sx={{ fontWeight: 'bold', bgcolor: '#e0f2fe', color: '#0369a1' }} 
                            />
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No complaints recorded.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 2. TB Screening */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      TB SCREENING & SYMPTOMS
                    </Typography>
                    {hasContent(assessment.tbScreening) ? (
                      <Stack spacing={0.5}>
                        {Object.entries(assessment.tbScreening).map(([key, rawVal]) => {
                          const val = renderValue(rawVal);
                          return (
                            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                {key.replace(/([A-Z])/g, ' $1')}
                              </Typography>
                              <Typography variant="caption" fontWeight="bold" color={val === 'Yes' ? 'error.main' : 'text.primary'}>
                                {val}
                              </Typography>
                            </Box>
                          );
                        })}
                        {/* Additional suspected TB details */}
                        {hasContent(assessment.suspectedTBAdditionalSymptoms) && (
                          <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed #e2e8f0' }}>
                            <Typography variant="caption" fontWeight="bold" display="block" color="text.secondary" mb={0.5}>
                              Additional Symptoms:
                            </Typography>
                            {Object.entries(assessment.suspectedTBAdditionalSymptoms).map(([key, rawVal]) => {
                              const val = renderValue(rawVal);
                              if (val === 'No' || val === '--') return null;
                              return (
                                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                    {key.replace(/([A-Z])/g, ' $1')}
                                  </Typography>
                                  <Typography variant="caption" fontWeight="bold" color="error.main">
                                    {val}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                        {hasContent(assessment.suspectedTBExamFindings) && (
                          <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed #e2e8f0' }}>
                            <Typography variant="caption" fontWeight="bold" display="block" color="text.secondary" mb={0.5}>
                              Examination Findings:
                            </Typography>
                            {Object.entries(assessment.suspectedTBExamFindings).map(([key, rawVal]) => {
                              const val = renderValue(rawVal);
                              if (val === 'No' || val === '--') return null;
                              return (
                                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                    {key.replace(/([A-Z])/g, ' $1')}
                                  </Typography>
                                  <Typography variant="caption" fontWeight="bold" color="error.main">
                                    {val}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No TB screening records.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 3. Physical Exam (General) */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      PHYSICAL EXAMINATION - GENERAL
                    </Typography>
                    {assessment.physicalExamGeneral ? (
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Anemia</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {assessment.physicalExamGeneral.anemia === 0 ? 'None' : 
                             assessment.physicalExamGeneral.anemia === 1 ? 'Mild' : 
                             assessment.physicalExamGeneral.anemia === 2 ? 'Moderate' : 
                             assessment.physicalExamGeneral.anemia === 3 ? 'Severe' : '--'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Jaundice</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {assessment.physicalExamGeneral.jaundice === 0 ? 'None' : 
                             assessment.physicalExamGeneral.jaundice === 1 ? 'Mild' : 
                             assessment.physicalExamGeneral.jaundice === 2 ? 'Moderate' : 
                             assessment.physicalExamGeneral.jaundice === 3 ? 'Severe' : '--'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Edema</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {assessment.physicalExamGeneral.edema === 0 ? 'None' : 
                             assessment.physicalExamGeneral.edema === 1 ? 'Mild' : 
                             assessment.physicalExamGeneral.edema === 2 ? 'Moderate' : 
                             assessment.physicalExamGeneral.edema === 3 ? 'Severe' : '--'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Palpable Lymph Nodes</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {renderValue(assessment.physicalExamGeneral.lymphNodesPalpable)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Heart NAD</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {renderValue(assessment.physicalExamGeneral.heartNAD)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Lungs NAD</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {renderValue(assessment.physicalExamGeneral.lungsNAD)}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No general exam record.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 4. Physical Exam (Systemic) */}
                <Grid size={12}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      PHYSICAL EXAMINATION - SYSTEMIC
                    </Typography>
                    {hasContent(assessment.physicalExamSystemic) ? (
                      <Grid container spacing={1}>
                        {Object.entries(assessment.physicalExamSystemic).map(([key, rawVal]) => {
                          const val = renderValue(rawVal);
                          if (val === '--' || val === '') return null;
                          return (
                            <Grid size={{ xs: 12, sm: 6 }} key={key}>
                              <Box sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                                <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block">
                                  {key}
                                </Typography>
                                <Typography variant="body2" color="text.primary">
                                  {val}
                                </Typography>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No systemic examination findings reported.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 5. Patient H/O Illness */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      PATIENT HISTORY OF ILLNESS (H/O)
                    </Typography>
                    {hasContent(assessment.patientHistory) ? (
                      <Stack spacing={0.5}>
                        {Object.entries(assessment.patientHistory).map(([key, rawHost]) => {
                          const host = rawHost as any;
                          const status = host?.status || 'No';
                          const year = host?.year ? ` (Since ${host.year})` : '';
                          return (
                            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">{key}</Typography>
                              <Typography variant="caption" fontWeight="bold" color={status === 'Yes' || status === 'In The Past' ? 'primary.main' : 'text.primary'}>
                                {status}{year}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No patient history recorded.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 6. Family H/O Illness */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      FAMILY HISTORY OF ILLNESS (H/O)
                    </Typography>
                    {hasContent(assessment.familyHistory) ? (
                      <Stack spacing={0.5}>
                        {Object.entries(assessment.familyHistory).map(([key, rawHost]) => {
                          const host = rawHost as any;
                          const status = host?.status || 'No';
                          const records = host?.records && host.records.length > 0
                            ? ` [${host.records.map((r: any) => `${r.relation || 'Relative'} - ${r.year || 'Unknown'}`).join(', ')}]`
                            : '';
                          return (
                            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">{key}</Typography>
                              <Typography variant="caption" fontWeight="bold" color={status === 'Yes' || status === 'In The Past' ? 'primary.main' : 'text.primary'}>
                                {status}{records}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No family history recorded.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 7. Current Medications Taken (Current Rx) */}
                <Grid size={12}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      CURRENT MEDICATIONS TAKEN
                    </Typography>
                    {assessment.currentRx && assessment.currentRx.length > 0 ? (
                      <Stack spacing={1}>
                        {assessment.currentRx.map((rx: any, idx: number) => (
                          <Box key={idx} sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, borderLeft: '3px solid #10b981' }}>
                            <Typography variant="body2" fontWeight="bold">
                              {rx.name} (Dose: {rx.dose} {rx.doseUnit})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Frequency: every {rx.frequencyHours || '--'} hours • Duration: {rx.duration} {rx.durationUnit} • Allergy reported: {rx.isAllergic ? 'YES' : 'No'}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No current medications recorded.</Typography>
                    )}
                  </Paper>
                </Grid>

                {/* 8. Social History & Wellbeing */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                      SOCIAL HISTORY & WELLBEING
                    </Typography>
                    <Stack spacing={0.5}>
                      {hasContent(assessment.socialHistory) && Object.entries(assessment.socialHistory).map(([key, rawVal]) => (
                        <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{key}</Typography>
                          <Typography variant="caption" fontWeight="bold">{renderValue(rawVal)}</Typography>
                        </Box>
                      ))}
                      {assessment.wellbeing && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed #e2e8f0' }}>
                          <Typography variant="caption" color="text.secondary">Signs of Mental Illness</Typography>
                          <Typography variant="caption" fontWeight="bold" sx={{ float: 'right' }}>
                            {renderValue(assessment.wellbeing.signsOfMentalIllness)}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                </Grid>

                {/* 9. Reproductive Health (if present) */}
                {hasContent(assessment.reproductiveHealth) && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff', height: '100%' }} variant="outlined">
                      <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                        REPRODUCTIVE HEALTH
                      </Typography>
                      <Stack spacing={0.5}>
                        {assessment.reproductiveHealth.obstetric && (
                          <Box>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block">Obstetric History:</Typography>
                            <Box sx={{ pl: 1, fontSize: '0.75rem' }}>
                              Gravida: {renderValue(assessment.reproductiveHealth.obstetric.gravida)} • Para: {renderValue(assessment.reproductiveHealth.obstetric.para)} • Live Births (Male/Female): {renderValue(assessment.reproductiveHealth.obstetric.liveMaleBirth)}/{renderValue(assessment.reproductiveHealth.obstetric.liveFemaleBirth)}
                            </Box>
                          </Box>
                        )}
                        {assessment.reproductiveHealth.menstrual && (
                          <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px dashed #e2e8f0' }}>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block">Menstrual History:</Typography>
                            <Box sx={{ pl: 1, fontSize: '0.75rem' }}>
                              LMP: {renderValue(assessment.reproductiveHealth.menstrual.lmp)} • Product: {renderValue(assessment.reproductiveHealth.menstrual.menstruationProduct)} • Method: {renderValue(assessment.reproductiveHealth.menstrual.contraceptionMethod)}
                            </Box>
                          </Box>
                        )}
                        {assessment.reproductiveHealth.cervicalCancer && (
                          <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px dashed #e2e8f0' }}>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block">Cervical Cancer Screening:</Typography>
                            <Box sx={{ pl: 1, fontSize: '0.75rem' }}>
                              VIA Results: {renderValue(assessment.reproductiveHealth.cervicalCancer.viaResults)} • Referred: {renderValue(assessment.reproductiveHealth.cervicalCancer.referred)} ({renderValue(assessment.reproductiveHealth.cervicalCancer.where)})
                            </Box>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                )}

                {/* 10. Cardiovascular Risk Assessment Scores */}
                {(hasContent(assessment.cvRisk) || hasContent(assessment.cvRiskLab)) && (
                  <Grid size={12}>
                    <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffffff' }} variant="outlined">
                      <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', display: 'block', mb: 1 }}>
                        CARDIOVASCULAR HEALTH ASSESSMENT & WHO RISK SCORES
                      </Typography>
                      <Grid container spacing={2}>
                        {hasContent(assessment.cvRisk) && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ p: 1, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fef3c7' }}>
                              <Typography variant="caption" fontWeight="bold" color="amber.900" display="block">
                                Non-Lab Based 10-Year CV Risk:
                              </Typography>
                              <Typography variant="h5" fontWeight="bold" color="warning.main">
                                {assessment.cvRisk.riskScore !== null ? `${assessment.cvRisk.riskScore}%` : '--%'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                SBP: {renderValue(assessment.cvRisk.sbp)} mmHg • BMI: {renderValue(assessment.cvRisk.bmi)} • Smoker: {renderValue(assessment.cvRisk.isSmoker)} • Diabetes: {renderValue(assessment.cvRisk.diabetes)}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {hasContent(assessment.cvRiskLab) && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ p: 1, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #dcfce7' }}>
                              <Typography variant="caption" fontWeight="bold" color="green" display="block">
                                Lab-Based 10-Year CV Risk:
                              </Typography>
                              <Typography variant="h5" fontWeight="bold" color="success.main">
                                {assessment.cvRiskLab.riskScore !== null ? `${assessment.cvRiskLab.riskScore}%` : '--%'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Cholesterol: {renderValue(assessment.cvRiskLab.totalCholesterol)} {assessment.cvRiskLab.totalCholesterolUnit || 'mg/dL'} • HDL: {renderValue(assessment.cvRiskLab.hdlCholesterol)} mg/dL • SBP: {renderValue(assessment.cvRiskLab.sbp)} mmHg
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Box sx={{ bgcolor: '#fffbeb', p: 1.5, borderRadius: 2, border: '1px solid #fef3c7' }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'amber.900' }}>
                  No required clinical assessment details (Section 1) recorded for this encounter.
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  );
};
