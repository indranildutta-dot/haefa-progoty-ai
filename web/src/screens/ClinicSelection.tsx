import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActionArea, 
  Box,
  Paper,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { ArrowBack, DeleteOutline } from '@mui/icons-material';
import { CountryConfig, ClinicConfig } from '../config/countries';
import { clearBangladeshData } from '../services/adminService';

interface ClinicSelectionProps {
  selectedCountry: CountryConfig;
  onSelectClinic: (clinic: ClinicConfig) => void;
  onBack: () => void;
}

const ClinicSelection: React.FC<ClinicSelectionProps> = ({ selectedCountry, onSelectClinic, onBack }) => {
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    await clearBangladeshData();
    setIsClearing(false);
    setOpenClearDialog(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button onClick={onBack} startIcon={<ArrowBack />} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
            Back
          </Button>
          <Box>
            <Typography variant="h4" fontWeight={800} color="primary">
              Select Clinic
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {selectedCountry.name} {selectedCountry.flag}
            </Typography>
          </Box>
        </Box>
        
        {selectedCountry.id === 'BD' && (
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<DeleteOutline />}
            onClick={() => setOpenClearDialog(true)}
            size="small"
          >
            Clear BD Data
          </Button>
        )}
      </Box>

      <Grid container spacing={2}>
        {selectedCountry.clinics.map((clinic) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={clinic.id}>
            <Card 
              sx={{ 
                borderRadius: 3, 
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }
              }}
            >
              <CardActionArea onClick={() => onSelectClinic(clinic)} sx={{ p: 2, textAlign: 'left' }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>{clinic.name}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>ID: {clinic.id}</Typography>
                <Chip label="Active" size="small" color="success" sx={{ borderRadius: 1 }} />
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openClearDialog} onClose={() => !isClearing && setOpenClearDialog(false)}>
        <DialogTitle>Clear Bangladesh Data</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete all patient records, consultations, and other data for Bangladesh? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClearDialog(false)} disabled={isClearing}>Cancel</Button>
          <Button onClick={handleClearData} color="error" variant="contained" disabled={isClearing}>
            {isClearing ? <CircularProgress size={24} color="inherit" /> : 'Delete All Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClinicSelection;
