import React from 'react';
import { Box, Button, Modal, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { QrReader } from 'react-qr-reader';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ open, onClose, onScan }) => {
  return (
    <Modal 
      open={open} 
      onClose={onClose}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box sx={{ 
        position: 'relative',
        bgcolor: 'background.paper', 
        p: 4, 
        borderRadius: 4, 
        width: { xs: '90%', sm: 450 },
        boxShadow: 24,
        outline: 'none'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Scan Patient QR Code</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ 
          width: '100%', 
          borderRadius: 2, 
          overflow: 'hidden',
          border: '2px solid #e2e8f0',
          position: 'relative'
        }}>
          <QrReader
            onResult={(result, error) => {
              if (result) {
                onScan(result.getText());
              }
            }}
            constraints={{ facingMode: 'environment' }}
            containerStyle={{ width: '100%' }}
          />
          {/* Scanning Overlay */}
          <Box sx={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            right: '10%',
            bottom: '10%',
            border: '2px dashed #3b82f6',
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 10
          }} />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Position the patient's QR code within the frame to scan.
        </Typography>

        <Button 
          fullWidth 
          variant="outlined" 
          color="inherit" 
          sx={{ mt: 3, borderRadius: 2 }} 
          onClick={onClose}
        >
          Cancel
        </Button>
      </Box>
    </Modal>
  );
};

export default QrScannerModal;
