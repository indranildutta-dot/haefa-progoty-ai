import React from 'react';
import { Box, Paper, Typography, Divider, Stack } from '@mui/material';
import { 
  MonitorWeight as WeightIcon, 
  Height as HeightIcon, 
  Favorite as HeartIcon, 
  Thermostat as TempIcon,
  Opacity as OpacityIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { useLocation } from 'react-router-dom';

interface ClinicalSidebarProps {
  encounterId?: string;
}

const ClinicalSidebar: React.FC<ClinicalSidebarProps> = ({ encounterId }) => {
  const { selectedPatient } = useAppStore();
  const location = useLocation();

  if (!selectedPatient) return null;

  const v = selectedPatient.currentVitals;
  const isCurrentEncounter = v && encounterId && v.encounter_id === encounterId;

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

  // Station specificity for previous stations only
  const isVitals1 = location.pathname.includes('vitals-1');
  const isVitals2 = location.pathname.includes('vitals-2');
  const isLabsAndRisk = location.pathname.includes('labs-and-risk');

  // Logic: Only show data collected in PREVIOUS stations
  const showAnthroAllowed = !isVitals1;
  const showVitalsAllowed = !isVitals1 && !isVitals2;
  const showLabsAllowed = !isVitals1 && !isVitals2 && !isLabsAndRisk;

  // Real-time Day Presence Checking (strictly require active today's encounter)
  const hasAnthroData = isCurrentEncounter && v && (
    (typeof v.weight === 'number' && !isNaN(v.weight) && v.weight > 0) || 
    (typeof v.height === 'number' && !isNaN(v.height) && v.height > 0) || 
    (v.muac && !isNaN(v.muac) && v.muac > 0)
  );

  const hasVitalsData = isCurrentEncounter && v && (
    (typeof v.systolic === 'number' && !isNaN(v.systolic) && v.systolic > 0) || 
    (typeof v.heartRate === 'number' && !isNaN(v.heartRate) && v.heartRate > 0) || 
    (typeof v.temperature === 'number' && !isNaN(v.temperature) && v.temperature > 0)
  );

  const hasLabsData = isCurrentEncounter && v && (
    (typeof v.rbg === 'number' && !isNaN(v.rbg) && v.rbg > 0) || 
    (typeof v.fbg === 'number' && !isNaN(v.fbg) && v.fbg > 0) || 
    (typeof v.hemoglobin === 'number' && !isNaN(v.hemoglobin) && v.hemoglobin > 0)
  );

  const displayAnthro = showAnthroAllowed && hasAnthroData;
  const displayVitals = showVitalsAllowed && hasVitalsData;
  const displayLabs = showLabsAllowed && hasLabsData;

  const showsAnything = displayAnthro || displayVitals || displayLabs;

  const isAbnormalTemp = v?.temperature && (v.temperature >= 38.0 || v.temperature < 37.0);
  const isAbnormalHR = v?.heartRate && (v.heartRate > 100 || v.heartRate < 60);
  
  const hasSecondBP = v && v.systolic_2 !== undefined && v.systolic_2 !== null && !isNaN(v.systolic_2) && v.systolic_2 > 0 &&
                      v.diastolic_2 !== undefined && v.diastolic_2 !== null && !isNaN(v.diastolic_2) && v.diastolic_2 > 0;
  const sysVal = v ? (hasSecondBP ? v.systolic_2 : v.systolic) : NaN;
  const diaVal = v ? (hasSecondBP ? v.diastolic_2 : v.diastolic) : NaN;
  const isAbnormalBP = sysVal && diaVal && (sysVal > 129 || sysVal < 110 || diaVal >= 80 || diaVal < 60);
  const isAbnormalO2 = v?.oxygenSaturation && !isNaN(v.oxygenSaturation) && v.oxygenSaturation > 0 && v.oxygenSaturation < 93;

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        width: '100%', 
        p: 3, 
        borderRadius: 4, 
        border: '1px solid #e2e8f0', 
        bgcolor: 'white',
        height: 'fit-content',
        position: 'sticky',
        top: 100,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto'
      }}
    >
      <Typography variant="h6" fontWeight="900" sx={{ mb: 3, color: 'primary.main', fontSize: '1rem', letterSpacing: '0.05em' }}>
        STATION DATA SUMMARY
      </Typography>

      {!showsAnything ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}>
          No data collected today from previous stations.
        </Typography>
      ) : (
        <Stack spacing={4}>
          {displayAnthro && (
            <Box>
              <Typography variant="overline" fontWeight="900" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
                Anthropometry
              </Typography>
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
          )}

          {displayVitals && (
            <Box>
              <Typography variant="overline" fontWeight="900" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
                Vital Signs
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <DataRow 
                icon={<HeartIcon />} 
                label="Blood Pressure" 
                value={(!isNaN(sysVal) && !isNaN(diaVal)) ? `${sysVal}/${diaVal}` : '--'} 
                unit="mmHg" 
                isEmergency={(!isNaN(sysVal) && sysVal > 0 && (sysVal >= 140 || sysVal <= 99)) || (!isNaN(diaVal) && diaVal > 0 && (diaVal > 90 || diaVal < 50))}
                isWarning={(!isNaN(sysVal) && sysVal > 0 && ((sysVal >= 130 && sysVal <= 139) || (sysVal >= 100 && sysVal <= 109))) || (!isNaN(diaVal) && diaVal > 0 && ((diaVal >= 80 && diaVal <= 90) || (diaVal >= 50 && diaVal < 60)))}
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
                isEmergency={v.temperature >= 39.5 || (v.temperature > 0 && v.temperature < 35.0)}
                isWarning={(v.temperature >= 38.0 && v.temperature < 39.5) || (v.temperature >= 35.0 && v.temperature < 37.0)}
              />
            </Box>
          )}

          {displayLabs && (
            <Box>
              <Typography variant="overline" fontWeight="900" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
                Labs & Risk
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {v.rbg > 0 && (
                <DataRow 
                  label="RBG" 
                  value={v.rbg} 
                  unit="mg/dL" 
                  isEmergency={v.rbg >= 200}
                  isWarning={v.rbg >= 140 && v.rbg < 200}
                />
              )}
              {v.fbg > 0 && (
                <DataRow 
                  label="FBG" 
                  value={v.fbg} 
                  unit="mg/dL" 
                  isEmergency={v.fbg >= 126}
                  isWarning={v.fbg >= 100 && v.fbg < 126}
                />
              )}
              {v.hemoglobin > 0 && (
                <DataRow 
                  label="Hemoglobin" 
                  value={v.hemoglobin} 
                  unit="g/dL" 
                  isEmergency={v.hemoglobin < 7}
                  isWarning={v.hemoglobin < 11}
                />
              )}
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default ClinicalSidebar;
