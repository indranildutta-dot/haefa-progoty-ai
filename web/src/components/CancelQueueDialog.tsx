import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  Box,
  Alert
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

interface CancelQueueDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  patientName: string;
}

const CancelQueueDialog: React.FC<CancelQueueDialogProps> = ({ 
  open, 
  onClose, 
  onConfirm, 
  patientName 
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(true);
      return;
    }
    onConfirm(reason);
    setReason('');
    setError(false);
  };

  const handleClose = () => {
    setReason('');
    setError(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      PaperProps={{ sx: { borderRadius: 4, p: 1, width: '100%', maxWidth: 450 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'error.main', fontWeight: 900 }}>
        <WarningIcon /> TERMINATE VISIT
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3, fontWeight: 700 }}>
          Are you sure you want to cancel the visit for <span style={{ color: '#1e293b' }}>{patientName}</span>?
        </Typography>
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          This will remove the patient from the queue and end their current session prematurely.
        </Alert>
        <TextField
          fullWidth
          label="Reason for Cancellation"
          placeholder="e.g. Patient left, emergency referral, etc."
          multiline
          rows={3}
          required
          error={error}
          helperText={error ? "A reason is mandatory to cancel a visit." : ""}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (e.target.value.trim()) setError(false);
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={handleClose} 
          variant="outlined" 
          sx={{ borderRadius: 2, fontWeight: 800, px: 3 }}
        >
          BACK
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="error" 
          sx={{ borderRadius: 2, fontWeight: 900, px: 3 }}
        >
          CONFIRM CANCELLATION
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CancelQueueDialog;
