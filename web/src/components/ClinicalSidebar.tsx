import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Divider, Stack, Chip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  MonitorWeight as WeightIcon, 
  Height as HeightIcon, 
  Favorite as HeartIcon, 
  Thermostat as TempIcon,
  Opacity as OpacityIcon,
  SmokingRooms as TobaccoIcon,
  WineBar as AlcoholIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { getEncountersByPatient, getVitalsByEncounter } from '../services/encounterService';
import { VitalsRecord, Encounter } from '../types';
import { useLocation } from 'react-router-dom';

const ClinicalSidebar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const location = useLocation();
  const [lastVisit, setLastVisit] = useState<Encounter | null>(null);
  const [lastVitals, setLastVitals] = useState<VitalsRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const isAnthropometryPage = location.pathname.includes('vitals-1');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedPatient?.id) return;
      setLoading(true);
      try {
        const encounters = await getEncountersByPatient(selectedPatient.id);
        // The first one is the current one, so we need the second one for "Last Visit"
        // But wait, if they just started, the current one might be the only one.
        // We need the most recent COMPLETED or previous encounter.
        // Actually, let's just get the one that is NOT the current encounter_id if we have it.
        const currentEncounterId = selectedPatient.latest_encounter_id;
        const previousEncounters = encounters.filter(e => e.id !== currentEncounterId);
        
        if (previousEncounters.length > 0) {
          const last = previousEncounters[0];
          setLastVisit(last);
          const vitals = await getVitalsByEncounter(last.id);
          setLastVitals(vitals);
        } else {
          setLastVisit(null);
          setLastVitals(null);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [selectedPatient?.id, selectedPatient?.latest_encounter_id]);

  if (!selectedPatient) return null;

  const v = selectedPatient.currentVitals;

  const DataRow = ({ icon, label, value, unit, color, isEmergency, isWarning }: any) => (
    <Box sx={{ 
      mb: 2,
      p: (isEmergency || isWarning) ? 1 : 0,
      borderRadius: 2,
      border: isEmergency ? '4px solid #ef4444' : isWarning ? '4px solid #f59e0b' : 'none',
      boxShadow: isEmergency ? '0 0 15px rgba(239, 68, 68, 0.3)' : isWarning ? '0 0 15px rgba(245, 158, 11, 0.3)' : 'none'
    }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {icon && React.cloneElement(icon, { sx: { fontSize: 16, color: color || 'text.secondary' } })}
        <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body1" fontWeight="900" color={isEmergency ? '#ef4444' : isWarning ? '#f59e0b' : '#1e293b'}>
        {value || '--'} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{unit}</span>
      </Typography>
    </Box>
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        width: 300, 
        p: 3, 
        borderRadius: 4, 
        border: '1px solid #e2e8f0', 
        bgcolor: 'white',
        height: 'fit-content',
        position: 'sticky',
        top: 100,
        display: { xs: 'none', sm: 'block' },
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto'
      }}
    >
      <Typography variant="h6" fontWeight="900" sx={{ mb: 3, color: 'primary.main' }}>
        CLINICAL SUMMARY
      </Typography>

      <Stack spacing={3}>
        {/* Current Visit Data */}
        {v && (
          <>
            <Box>
              <Typography variant="overline" fontWeight="900" color="text.disabled">Anthropometry</Typography>
              <Divider sx={{ mb: 2 }} />
              <DataRow icon={<HeightIcon />} label="Height" value={v.height} unit="cm" />
              <DataRow icon={<WeightIcon />} label="Weight" value={v.weight} unit="kg" />
              <DataRow 
                icon={<WeightIcon />} 
                label="BMI" 
                value={v.bmi} 
                unit={v.bmi_class} 
                color={v.bmi_class === 'Obese' ? '#ef4444' : v.bmi_class === 'Overweight' ? '#f59e0b' : 'primary.main'}
                isEmergency={v.bmi_class === 'Obese'}
                isWarning={v.bmi_class === 'Overweight'}
              />
              {v.muac && (
                <DataRow 
                  icon={<WeightIcon />} 
                  label="MUAC" 
                  value={v.muac} 
                  unit={v.muac_class} 
                  color={v.muac_class === 'Severely Malnourished' ? '#ef4444' : v.muac_class === 'Moderately Malnourished' ? '#f59e0b' : 'primary.main'}
                  isEmergency={v.muac_class === 'Severely Malnourished'}
                  isWarning={v.muac_class === 'Moderately Malnourished'}
                />
              )}
              {v.blood_group && <DataRow icon={<OpacityIcon />} label="Blood Group" value={v.blood_group} color="error.main" />}
            </Box>

            <Box>
              <Typography variant="overline" fontWeight="900" color="text.disabled">Vital Signs</Typography>
              <Divider sx={{ mb: 2 }} />
              <DataRow 
                icon={<HeartIcon />} 
                label="Blood Pressure" 
                value={(!isNaN(v.systolic) && !isNaN(v.diastolic)) ? `${v.systolic}/${v.diastolic}` : '--'} 
                unit="mmHg" 
                isEmergency={v.systolic >= 180 || v.diastolic >= 120}
                isWarning={(v.systolic >= 130 && v.systolic < 180) || (v.diastolic >= 80 && v.diastolic < 120)}
              />
              <DataRow 
                icon={<HeartIcon />} 
                label="Heart Rate" 
                value={v.heartRate} 
                unit="bpm" 
                isEmergency={v.heartRate > 120 || (v.heartRate > 0 && v.heartRate < 50)}
                isWarning={(v.heartRate > 100 && v.heartRate <= 120) || (v.heartRate > 50 && v.heartRate < 60)}
              />
              <DataRow 
                icon={<OpacityIcon />} 
                label="SpO2" 
                value={v.oxygenSaturation} 
                unit="%" 
                isEmergency={v.oxygenSaturation > 0 && v.oxygenSaturation < 90}
                isWarning={v.oxygenSaturation >= 90 && v.oxygenSaturation <= 92}
              />
              <DataRow 
                icon={<TempIcon />} 
                label="Temperature" 
                value={v.temperature} 
                unit="°C" 
                isEmergency={v.temperature >= 39 || (v.temperature > 0 && v.temperature < 35)}
                isWarning={(v.temperature >= 38 && v.temperature < 39) || (v.temperature >= 35 && v.temperature < 36)}
              />
            </Box>
          </>
        )}

        {/* Last Visit Section */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <HistoryIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="overline" fontWeight="900" color="primary">Last Visit</Typography>
          </Stack>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>
            {lastVisit ? formatDate(lastVisit.created_at) : 'None'}
          </Typography>
          
          {lastVisit && lastVitals && (
            <Stack spacing={1}>
              <Accordion elevation={0} sx={{ border: '1px solid #f1f5f9', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption" fontWeight="900">ANTHROPOMETRY</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <DataRow label="Height" value={lastVitals.height} unit="cm" />
                  <DataRow label="Weight" value={lastVitals.weight} unit="kg" />
                  <DataRow 
                    label="BMI" 
                    value={lastVitals.bmi} 
                    unit={lastVitals.bmi_class}
                    isEmergency={lastVitals.bmi_class === 'Obese'}
                    isWarning={lastVitals.bmi_class === 'Overweight'}
                  />
                </AccordionDetails>
              </Accordion>

              <Accordion elevation={0} sx={{ border: '1px solid #f1f5f9', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption" fontWeight="900">VITAL SIGNS</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <DataRow label="BP" value={`${lastVitals.systolic}/${lastVitals.diastolic}`} unit="mmHg" />
                  <DataRow label="HR" value={lastVitals.heartRate} unit="bpm" />
                  <DataRow label="SpO2" value={lastVitals.oxygenSaturation} unit="%" />
                </AccordionDetails>
              </Accordion>

              <Accordion elevation={0} sx={{ border: '1px solid #f1f5f9', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption" fontWeight="900">LABS</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <DataRow label="Sugar" value={lastVitals.blood_sugar} unit="mg/dL" />
                  <DataRow label="Hgb" value={lastVitals.hemoglobin} unit="g/dL" />
                </AccordionDetails>
              </Accordion>
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

export default ClinicalSidebar;
