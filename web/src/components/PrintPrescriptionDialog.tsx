import React, { useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Box, IconButton, Paper 
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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = document.getElementById('prescription-print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Prescription - ${encounterId}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: A4; margin: 0; }
              #prescription-print-area { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; }
            }
            body { font-family: 'Inter', sans-serif; }
          </style>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
        </head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}
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
            <PrescriptionPrintTemplate encounterId={encounterId} />
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, fontWeight: 900 }}>
          Close
        </Button>
        <Button 
          onClick={handlePrint} 
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
