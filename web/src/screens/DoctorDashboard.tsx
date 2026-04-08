import React, { 
  useState, 
  useEffect 
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
  Tooltip
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import CancelIcon from '@mui/icons-material/Cancel';
import { auth } from "../firebase";
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
import StationLayout from '../components/StationLayout';
import StationSearchHeader from '../components/StationSearchHeader';
import PatientContextBar from '../components/PatientContextBar';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import { initialClinicalAssessment } from '../components/ClinicalAssessmentPanel';
import CancelQueueDialog from '../components/CancelQueueDialog';
import PrintPrescriptionDialog from '../components/PrintPrescriptionDialog';

interface DoctorDashboardProps {
  countryId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const { 
    notify, 
    selectedClinic, 
    selectedPatient,
    setSelectedPatient 
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
  
  const [consultData, setConsultData] = useState<any>({ 
    diagnosis: '', 
    notes: '', 
    treatmentNotes: '', 
    prescriptions: [], 
    clinicalAssessment: initialClinicalAssessment 
  });

  /**
   * QUEUE SUBSCRIPTION:
   * Monitors patients ready for consultation or already in progress.
   */
  useEffect(() => {
    if (!selectedClinic) return;
    
    const unsubscribe = subscribeToQueue(
      ['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, 
      setWaitingList, 
      (err) => console.error("Doctor Queue Error:", err)
    );
    
    return () => unsubscribe();
  }, [selectedClinic]);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  /**
   * PATIENT INTAKE LOGIC:
   * Sets the patient context and pulls the multi-station vitals 
   * recorded earlier (Anthropometry, Cardio, and Labs).
   */
  const handleOpenConsult = async (item: any) => {
    try {
      setSelectedItem(item);
      
      const [patient, vitals] = await Promise.all([
        getPatientById(item.patient_id), 
        getVitalsByEncounter(item.encounter_id)
      ]);
      
      setCurrentVitals(vitals);
      
      // Update global store for context-aware components
      setSelectedPatient({ 
        ...patient, 
        currentVitals: vitals, 
        triage_level: item.triage_level 
      });
      
      // Mark as active in the queue
      await updateQueueStatus(item.id, 'IN_CONSULTATION' as any);
      
    } catch (e) { 
      notify("Critical error loading patient context.", "error"); 
      console.error(e);
    }
  };

  const handleCancel = async () => {
    if (!selectedItem) return;
    setOpenCancelDialog(true);
  };

  const confirmCancel = async () => {
    setOpenCancelDialog(false);
    try {
      await updateQueueStatus(selectedItem.id, 'READY_FOR_DOCTOR' as any);
      notify("Consultation cancelled. Patient returned to queue.", "info");
      setSelectedItem(null);
      setSelectedPatient(null);
      setConsultData({
        diagnosis: '', 
        notes: '', 
        treatmentNotes: '', 
        prescriptions: [], 
        clinicalAssessment: initialClinicalAssessment
      });
    } catch (e) {
      notify("Error cancelling consultation.", "error");
      console.error(e);
    }
  };

  const handleCancelQueueItem = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await cancelQueueItem(cancelTarget.id!, reason);
      notify(`Visit cancelled for ${cancelTarget.patient_name}`, 'info');
      setCancelTarget(null);
    } catch (err) {
      console.error("Cancel Error:", err);
      notify("Failed to cancel visit", "error");
    }
  };

  const isAssessmentComplete = () => {
    const assessment = consultData.clinicalAssessment;
    const statuses = assessment?.sectionStatuses || {};
    
    // Conditional logic for suspected TB sections
    const { cough, lgerf, nightSweat, weightLoss } = assessment.tbScreening || {};
    const countYes = [lgerf, nightSweat, weightLoss].filter(v => v === 'Yes').length;
    const suspectedTBActive = cough === 'Yes' || countYes >= 2;

    const suspectedTBSections = [
      'suspectedTBAdditionalSymptoms', 
      'suspectedTBExamFindings', 
      'suspectedTBPastHistory'
    ];

    const isFemaleOver12 = selectedPatient?.gender?.toLowerCase() === 'female' && calculateAgeYears(selectedPatient) > 12;

    return Object.entries(statuses).every(([section, status]) => {
      // If suspected TB is not active, ignore those specific sections
      if (!suspectedTBActive && suspectedTBSections.includes(section)) {
        return true;
      }
      // If not female over 12, ignore reproductive health
      if (!isFemaleOver12 && section === 'reproductiveHealth') {
        return true;
      }
      return status === 'Complete';
    });
  };

  const handleFinalize = async (status: string) => {
    if (!consultData.diagnosis) {
      notify("A primary diagnosis is required to finalize.", "warning");
      return;
    }

    if (!isAssessmentComplete()) {
      notify("Please complete all clinical assessment subsections (marked green) before proceeding.", "warning");
      return;
    }
    
    setIsFinalizing(true);
    
    try {
      // PERSISTENCE HANDSHAKE:
      // Saves all clinical findings, prescriptions, and assessment notes.
      await saveConsultation({ 
        ...consultData, 
        encounter_id: selectedItem.encounter_id, 
        patient_id: selectedItem.patient_id, 
        created_by: auth.currentUser?.uid 
      });
      
      // Advance patient to Pharmacy or Complete
      await updateQueueStatus(selectedItem.id!, status as any);
      
      setLastEncounterId(selectedItem.encounter_id);
      setShowPrintDialog(true);
      
      notify("Consultation finalized successfully.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
      setConsultData({
        diagnosis: '', 
        notes: '', 
        treatmentNotes: '', 
        prescriptions: [], 
        clinicalAssessment: initialClinicalAssessment
      });
      
    } catch (e) { 
      notify("Database Error: Failed to save consultation data.", "error"); 
      console.error(e);
    } finally {
      setIsFinalizing(false);
    }
  };

  const triageColors: any = { 
    emergency: '#ef4444', 
    urgent: '#f59e0b', 
    standard: '#10b981' 
  };

  return (
    <StationLayout 
      title="Doctor Dashboard" 
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

          <TableContainer 
            component={Paper} 
            elevation={0} 
            sx={{ 
              p: 2, 
              borderRadius: 4, 
              border: '1px solid #e2e8f0',
              bgcolor: 'white'
            }}
          >
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
                {waitingList.map(item => {
                  const isHighlighted = highlightedPatientIds.includes(item.patient_id);
                  return (
                    <TableRow 
                      key={item.id} 
                      hover
                      sx={{ 
                        bgcolor: isHighlighted ? '#fef9c3' : 'inherit',
                        transition: 'background-color 0.3s ease',
                        borderLeft: isHighlighted ? '6px solid #facc15' : 'none'
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> 
                          <Typography variant="body2">
                            {formatWaitTime(item.created_at)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={item.triage_level?.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            bgcolor: triageColors[item.triage_level] || '#94a3b8', 
                            color: 'white', 
                            fontWeight: 900,
                            fontSize: '0.65rem'
                          }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {item.patient_name}
                        {isHighlighted && (
                          <Chip label="MATCH" size="small" color="warning" sx={{ ml: 2, fontWeight: 900, height: 20 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="Cancel Visit">
                            <IconButton 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelTarget(item);
                              }}
                              sx={{ mr: 1 }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          <Button 
                            variant="contained" 
                            color={isHighlighted ? "warning" : "primary"}
                            onClick={() => handleOpenConsult(item)}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                          >
                            Start Consultation
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {waitingList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 12 }}>
                      <Typography variant="body1" color="text.secondary">
                        The consultation queue is currently empty.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ mt: -3, pb: 12 }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* LEFT COLUMN: Vitals & Lab Results */}
            <Grid size={{ xs: 12, md: 2.5 }} sx={{ 
              position: 'sticky', 
              top: 80, 
              alignSelf: 'flex-start',
              maxHeight: 'calc(100vh - 160px)',
              overflowY: 'auto',
              pr: 1,
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '4px' }
            }}>
              <VitalsSnapshot vitals={currentVitals} />
            </Grid>

            {/* MIDDLE COLUMN: Clinical Assessment & Prescription */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: { xs: 2, md: 4 }, 
                  borderRadius: 4, 
                  minHeight: '700px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <Typography variant="h6" fontWeight="900" gutterBottom color="primary">
                  CLINICAL ASSESSMENT
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                {/* FIXED ID HANDSHAKE:
                   Explicitly passing patientId and encounterId to ensure 
                   ConsultationPanel anchors data correctly.
                */}
                <ConsultationPanel 
                  data={consultData} 
                  onChange={setConsultData} 
                  patientId={selectedItem.patient_id}
                  encounterId={selectedItem.encounter_id}
                />
                
                {!isAssessmentComplete() && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2' }}>
                    <Typography variant="caption" color="error" sx={{ display: 'block', textAlign: 'center', fontWeight: 'bold' }}>
                      * All Clinical Assessment subsections must be marked COMPLETE (Green)
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* RIGHT COLUMN: Patient History & Trends */}
            <Grid size={{ xs: 12, md: 2.5 }} sx={{ 
              position: 'sticky', 
              top: 80, 
              alignSelf: 'flex-start',
              maxHeight: 'calc(100vh - 160px)',
              overflowY: 'auto',
              pl: 1,
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '4px' }
            }}>
              <PatientHistoryTimeline patientId={selectedItem.patient_id} />
            </Grid>
          </Grid>

          {/* BOTTOM ACTION BAR */}
          <Box 
            sx={{ 
              position: 'fixed', 
              bottom: 0, 
              left: 0, 
              right: 0, 
              bgcolor: 'white', 
              borderTop: '1px solid #e2e8f0', 
              p: 2, 
              zIndex: 1100,
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
            }}
          >
            <Button 
              variant="outlined" 
              sx={{ 
                px: { xs: 2, md: 4 }, 
                height: 50, 
                fontWeight: 900, 
                borderRadius: 2,
                fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' }
              }} 
              onClick={() => handleFinalize('IN_CONSULTATION')}
              disabled={isFinalizing}
            >
              Save Progress
            </Button>
            <Button 
              variant="outlined" 
              color="error"
              sx={{ 
                px: { xs: 2, md: 4 }, 
                height: 50, 
                fontWeight: 900, 
                borderRadius: 2,
                fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' }
              }} 
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="info" 
              sx={{ 
                px: { xs: 2, md: 4 }, 
                height: 50, 
                fontWeight: 900, 
                borderRadius: 2,
                fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' }
              }} 
              disabled={isFinalizing || !isAssessmentComplete() || !consultData.diagnosis}
              onClick={() => handleFinalize('COMPLETED')}
            >
              {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "Complete Diagnosis"}
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              sx={{ 
                px: { xs: 2, md: 4 }, 
                height: 50, 
                fontWeight: 900, 
                borderRadius: 2,
                fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' }
              }} 
              disabled={isFinalizing || !isAssessmentComplete() || !consultData.diagnosis}
              onClick={() => handleFinalize('WAITING_FOR_PHARMACY')}
            >
              {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "Complete & Send to Pharmacy"}
            </Button>
          </Box>
        </Box>
      )}

      {/* CANCEL CONFIRMATION DIALOG */}
      <Dialog 
        open={openCancelDialog} 
        onClose={() => setOpenCancelDialog(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight="900" gutterBottom>
            Cancel Consultation?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            This will discard any unsaved progress and return the patient to the doctor's queue.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button 
              variant="outlined" 
              onClick={() => setOpenCancelDialog(false)}
              sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
            >
              No, Keep Working
            </Button>
            <Button 
              variant="contained" 
              color="error"
              onClick={confirmCancel}
              sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
            >
              Yes, Cancel
            </Button>
          </Stack>
        </Box>
      </Dialog>
      <CancelQueueDialog 
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelQueueItem}
        patientName={cancelTarget?.patient_name || ''}
      />
      {lastEncounterId && (
        <PrintPrescriptionDialog 
          open={showPrintDialog} 
          onClose={() => setShowPrintDialog(false)} 
          encounterId={lastEncounterId} 
        />
      )}
    </StationLayout>
  );
};

export default DoctorDashboard;