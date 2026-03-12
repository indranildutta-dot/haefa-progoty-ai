import React, { useState } from 'react';
import { Box, Button, Modal, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { QrReader } from 'react-qr-reader';

interface QrScannerModalProps {
  onScan: (data: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ onScan }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outlined" 
        color="primary" 
        startIcon={<QrCodeScannerIcon />} 
        onClick={() => setOpen(true)}
        sx={{ borderRadius: 2 }}
      >
        Scan QR Code
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          bgcolor: 'background.paper', 
          p: 4, 
          borderRadius: 4, 
          width: 400,
          boxShadow: 24
        }}>
          <Typography variant="h6" gutterBottom>Scan Patient QR Code</Typography>
          <QrReader
            onResult={(result, error) => {
              if (result) {
                onScan(result.getText());
                setOpen(false);
              }
            }}
            constraints={{ facingMode: 'environment' }}
            containerStyle={{ width: '100%' }}
          />
          <Button fullWidth variant="contained" color="error" sx={{ mt: 2 }} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Box>
      </Modal>
    </>
  );
};

export default QrScannerModal;
