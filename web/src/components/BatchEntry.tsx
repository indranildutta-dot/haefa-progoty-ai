import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  Alert
} from '@mui/material';
import { bulkUpload } from '../services/pharmacyService';

interface BatchEntryProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchEntry: React.FC<BatchEntryProps> = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];
        await bulkUpload(base64Data);
        onSuccess();
        onClose();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to upload file.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Batch Inventory Entry</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Upload an Excel file with columns: medication_id, batch_id, expiry_date, quantity, base_unit, package_unit.
        </Typography>
        <input type="file" accept=".xlsx" onChange={handleFileChange} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleUpload} disabled={!file || loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchEntry;
