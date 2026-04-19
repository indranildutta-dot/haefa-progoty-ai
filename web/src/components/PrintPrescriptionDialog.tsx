import React, { useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Box, IconButton, Paper 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import PrescriptionPrintTemplate from './PrescriptionPrintTemplate';
import { useReactToPrint } from 'react-to-print';

interface PrintPrescriptionDialogProps {
  open: boolean;
  onClose: () => void;
  encounterId: string;
}

const PrintPrescriptionDialog: React.FC<PrintPrescriptionDialogProps> = ({ open, onClose, encounterId }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Prescription-${encounterId}`,
    onAfterPrint: () => console.log("Print process completed."),
    onPrintError: (error) => {
      console.error("Print Error:", error);
      // Fallback to window.print() if react-to-print fails
      window.print();
    }
  });

  const onPrintClick = () => {
    console.log("HAEFA: Initiating print for encounter:", encounterId);
    if (typeof handlePrint === 'function') {
      handlePrint();
    } else {
      console.warn("HAEFA: handlePrint not ready, falling back to window.print()");
      window.print();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ id: 'print-dialog-content', sx: { borderRadius: 4, overflow: 'hidden' } }}
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
            <div ref={componentRef} id="printable-prescription-content">
              <PrescriptionPrintTemplate encounterId={encounterId} />
            </div>
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
          startIcon={<PrintIcon />}
          sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
        >
          Print Prescription
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintPrescriptionDialog;
