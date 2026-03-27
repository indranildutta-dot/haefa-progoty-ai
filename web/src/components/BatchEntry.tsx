import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  Alert,
  LinearProgress,
  IconButton,
  Stack,
  Paper
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { bulkUpload } from '../services/pharmacyService';

interface BatchEntryProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * BatchEntry Component
 * Handles Excel (.xlsx) file uploads for clinic inventory.
 * Fully optimized for tablet touch interaction.
 */
const BatchEntry: React.FC<BatchEntryProps> = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Handlers --

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.xlsx')) {
        setError("Invalid file type. Please upload an Excel (.xlsx) file.");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setIsSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const base64Content = e.target?.result as string;
          // Extract only the base64 data portion (removing the data:URL prefix)
          const base64Data = base64Content.split(',')[1];
          
          if (!base64Data) {
            throw new Error("Could not parse file data.");
          }

          // Trigger the Node 20 Backend Function
          await bulkUpload(base64Data);
          
          setIsSuccess(true);
          setFile(null);
          
          // Brief delay so user sees the success state before closing
          setTimeout(() => {
            onSuccess();
            onClose();
            setIsSuccess(false);
          }, 1500);

        } catch (err: any) {
          console.error("Upload error:", err);
          setError(err.message || "Failed to process the inventory file.");
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError("Error reading file. The file might be corrupted.");
        setLoading(false);
      };

      reader.readAsDataURL(file);

    } catch (err) {
      setError("An unexpected error occurred during upload.");
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // -- Main View --

  return (
    <Dialog 
      open={open} 
      onClose={loading ? undefined : onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 3, p: 1 }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -0.5 }}>
          BATCH INVENTORY UPLOAD
        </Typography>
        <IconButton onClick={onClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Upload a standardized HAEFA Excel template to update medication stock levels for this clinic.
          </Typography>
          <Typography variant="caption" color="primary" fontWeight="700">
            Required Columns: medication_id, batch_id, expiry_date, quantity, dosage
          </Typography>
        </Box>

        {/* Upload Zone */}
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: file ? 'success.main' : 'primary.main',
            bgcolor: file ? 'success.50' : 'grey.50',
            textAlign: 'center',
            cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              bgcolor: loading ? 'grey.50' : file ? 'success.50' : '#f0f4ff'
            }
          }}
          onClick={() => !loading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            hidden
            ref={fileInputRef}
            accept=".xlsx"
            onChange={handleFileChange}
            disabled={loading}
          />
          
          {!file ? (
            <Stack spacing={1} alignItems="center">
              <CloudUploadIcon color="primary" sx={{ fontSize: 48 }} />
              <Typography variant="body1" fontWeight="700">
                Tap to Select Excel File
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Supported format: .xlsx only
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1} alignItems="center">
              <DescriptionIcon color="success" sx={{ fontSize: 48 }} />
              <Typography variant="body1" fontWeight="800" noWrap sx={{ maxWidth: '100%' }}>
                {file.name}
              </Typography>
              <Button 
                size="small" 
                color="error" 
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                disabled={loading}
              >
                Remove File
              </Button>
            </Stack>
          )}
        </Paper>

        {/* Status Indicators */}
        {loading && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="primary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
              PROCESSING INVENTORY DATA...
            </Typography>
            <LinearProgress sx={{ borderRadius: 1, height: 8 }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {isSuccess && (
          <Alert 
            icon={<CheckCircleOutlineIcon fontSize="inherit" />} 
            severity="success" 
            sx={{ mt: 3, borderRadius: 2, fontWeight: 700 }}
          >
            Inventory Uploaded Successfully!
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: 'grey.50', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
        <Button 
          onClick={onClose} 
          color="inherit" 
          disabled={loading}
          sx={{ fontWeight: 700 }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleUpload} 
          variant="contained" 
          disabled={!file || loading || isSuccess}
          startIcon={<CloudUploadIcon />}
          sx={{ 
            px: 4, 
            fontWeight: 800, 
            borderRadius: 2,
            minHeight: '48px' 
          }}
        >
          {loading ? 'UPLOADING...' : 'START UPLOAD'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchEntry;