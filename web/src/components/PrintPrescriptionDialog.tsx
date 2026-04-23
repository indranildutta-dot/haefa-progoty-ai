import React from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Box, IconButton, Paper, CircularProgress 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import PrescriptionPrintTemplate from './PrescriptionPrintTemplate';

interface PrintPrescriptionDialogProps {
  open: boolean;
  onClose: () => void;
  encounterId: string;
}

const PrintPrescriptionDialog: React.FC<PrintPrescriptionDialogProps> = ({ open, onClose, encounterId }) => {
  const [isReady, setIsReady] = React.useState(false);

  const onPrintClick = () => {
    if (!isReady) return;
    
    console.log("HAEFA: Initiating native print for encounter:", encounterId);
    
    // We rely on the @media print styles defined in PrescriptionPrintTemplate.tsx
    // which hide the main UI and show only the prescription content.
    window.print();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      slotProps={{
        paper: { id: 'print-dialog-content', sx: { borderRadius: 4, overflow: 'hidden' } }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrintIcon color="primary" />
          Prescription Preview
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#f1f5f9' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Paper elevation={4} sx={{ borderRadius: 0 }}>
            {/* The ID here matches the @media print rules in the template */}
            <PrescriptionPrintTemplate 
              encounterId={encounterId} 
              onReady={() => setIsReady(true)}
            />
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 900 }}>
          Close
        </Button>
        <Button 
          onClick={onPrintClick} 
          variant="contained" 
          startIcon={isReady ? <PrintIcon /> : <CircularProgress size={20} color="inherit" />}
          disabled={!isReady}
          sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
        >
          {isReady ? "Print Prescription" : "Preparing..."}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintPrescriptionDialog;
