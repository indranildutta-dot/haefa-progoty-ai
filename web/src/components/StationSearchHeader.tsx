import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Autocomplete, 
  InputAdornment, 
  IconButton, 
  CircularProgress,
  Paper,
  Typography,
  Stack,
  Avatar,
  Chip,
  Tooltip
} from '@mui/material';
import { 
  Search as SearchIcon, 
  QrCodeScanner as QrIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { searchPatients, getPatientById } from '../services/patientService';
import { addToQueue, subscribeToQueue } from '../services/queueService';
import { getLatestEncounter, createEncounter } from '../services/encounterService';
import { Patient, QueueItem, EncounterStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getSession } from '../utils/session';
import QrScannerModal from './QrScannerModal';

interface StationSearchHeaderProps {
  stationStatus: EncounterStatus;
  onPatientFound: (patient: Patient, queueItem?: QueueItem) => void;
  waitingList: QueueItem[];
  highlightedPatientIds: string[];
  setHighlightedPatientIds: (ids: string[]) => void;
}

const StationSearchHeader: React.FC<StationSearchHeaderProps> = ({ 
  stationStatus, 
  onPatientFound, 
  waitingList,
  highlightedPatientIds,
  setHighlightedPatientIds
}) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Patient[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const { notify, selectedClinic } = useAppStore();
  const { selectedCountry } = getSession();

  // Search logic
  useEffect(() => {
    if (inputValue.length < 2) {
      setOptions([]);
      setHighlightedPatientIds([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        // Determine search params based on input
        const params: any = {};
        if (/^\d+$/.test(inputValue)) {
          // Likely an ID or phone
          params.national_id = inputValue;
          params.phone = inputValue;
          params.rohingya_number = inputValue;
          params.nepal_id = inputValue;
        } else {
          // Likely a name
          const parts = inputValue.split(' ');
          params.given_name = parts[0];
          if (parts.length > 1) params.family_name = parts[1];
        }

        const results = await searchPatients(params);
        setOptions(results);

        // Highlight matching patients in the current queue
        const matchingIds = results
          .filter(p => waitingList.some(item => item.patient_id === p.id))
          .map(p => p.id);
        setHighlightedPatientIds(matchingIds);

      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [inputValue, waitingList]);

  const handleSelectPatient = async (patient: Patient) => {
    // 1. Check if patient is already in the current queue
    const existingQueueItem = waitingList.find(item => item.patient_id === patient.id);
    
    if (existingQueueItem) {
      // Just keep the highlight by setting the input value to the name
      setInputValue(`${patient.given_name} ${patient.family_name}`);
      setOpen(false);
      setQrOpen(false);
      return;
    }

    // 2. If not in queue, add them
    setLoading(true);
    try {
      // Find or create encounter
      let encounter = await getLatestEncounter(patient.id);
      let encounterId = encounter?.id;

      // If no encounter or encounter is old (not today), create new one
      const isToday = encounter?.created_at && 
        new Date(encounter.created_at.toMillis()).toDateString() === new Date().toDateString();

      if (!encounterId || !isToday) {
        encounterId = await createEncounter(patient.id);
      }

      // Add to queue for this station
      await addToQueue({
        patient_id: patient.id,
        patient_name: `${patient.given_name} ${patient.family_name}`,
        encounter_id: encounterId!,
        status: stationStatus,
        station: stationStatus.toLowerCase().includes('vitals') ? 'vitals' : 
                 stationStatus.toLowerCase().includes('doctor') ? 'doctor' : 
                 stationStatus.toLowerCase().includes('pharmacy') ? 'pharmacy' : 'registration'
      });

      notify(`Patient ${patient.given_name} added to queue`, 'success');
      
      // Set input value to name to highlight them in the list
      setInputValue(`${patient.given_name} ${patient.family_name}`);
      setOpen(false);
      setQrOpen(false);

    } catch (error) {
      console.error("Error adding to queue:", error);
      notify("Failed to add patient to queue", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = async (data: string) => {
    if (!data) return;
    
    setLoading(true);
    try {
      // QR code data is expected to be the patient ID
      const patient = await getPatientById(data);
      if (patient) {
        handleSelectPatient(patient);
      } else {
        notify("Patient not found from QR code", "error");
      }
    } catch (error) {
      console.error("QR Scan error:", error);
      notify("Invalid QR code", "error");
    } finally {
      setLoading(false);
      setQrOpen(false);
    }
  };

  const getIDLabel = () => {
    if (selectedCountry?.id === 'BD') return "NID or FDMN Number";
    if (selectedCountry?.id === 'NP') return "Nepal ID or Phone";
    return "National ID or Phone";
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        mb: 3, 
        borderRadius: 4, 
        border: '1px solid #e2e8f0',
        bgcolor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}
    >
      <Autocomplete
        fullWidth
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={options}
        loading={loading}
        inputValue={inputValue}
        onInputChange={(_, value) => setInputValue(value)}
        onChange={(_, patient) => patient && handleSelectPatient(patient)}
        getOptionLabel={(option) => `${option.given_name} ${option.family_name} (${option.national_id || option.rohingya_number || 'No ID'})`}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={`Search by Name, QR, or ${getIDLabel()}...`}
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <React.Fragment>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {inputValue && (
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setInputValue('');
                        setHighlightedPatientIds([]);
                      }}
                      sx={{ mr: 1 }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
              sx: { borderRadius: 3, bgcolor: '#f8fafc' }
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
              <Avatar sx={{ bgcolor: 'primary.light' }}>
                <PersonIcon />
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" fontWeight="bold">
                  {option.given_name} {option.family_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.gender} • {option.age_years}y • {option.national_id || option.rohingya_number || 'No ID'}
                </Typography>
              </Box>
              {waitingList.some(item => item.patient_id === option.id) ? (
                <Chip label="In Queue" size="small" color="success" variant="outlined" />
              ) : (
                <Chip label="Add to Queue" size="small" color="primary" icon={<AddIcon />} />
              )}
            </Stack>
          </Box>
        )}
      />
      
      {inputValue && (
        <Tooltip title="Clear Search & Highlights">
          <IconButton 
            onClick={() => {
              setInputValue('');
              setHighlightedPatientIds([]);
            }}
            sx={{ 
              bgcolor: '#f1f5f9', 
              color: '#64748b', 
              '&:hover': { bgcolor: '#e2e8f0' },
              width: 56,
              height: 56,
              borderRadius: 3
            }}
          >
            <ClearIcon />
          </IconButton>
        </Tooltip>
      )}
      
      <Tooltip title="Scan QR Code">
        <IconButton 
          color="primary" 
          onClick={() => setQrOpen(true)}
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            '&:hover': { bgcolor: 'primary.dark' },
            width: 56,
            height: 56,
            borderRadius: 3
          }}
        >
          <QrIcon />
        </IconButton>
      </Tooltip>

      <QrScannerModal 
        open={qrOpen} 
        onClose={() => setQrOpen(false)} 
        onScan={handleQrScan} 
      />
    </Paper>
  );
};

export default StationSearchHeader;
