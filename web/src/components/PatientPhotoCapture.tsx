import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Avatar, 
  CircularProgress, 
  LinearProgress, 
  Alert,
  Stack,
  IconButton
} from '@mui/material';
import CameraIcon from '@mui/icons-material/CameraAlt';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { useAppStore } from '../store/useAppStore';
import { openDB } from 'idb';

interface PatientPhotoCaptureProps {
  patientId?: string;
  onPhotoUploaded?: (url: string) => void;
  currentPhoto?: string;
}

type UIState = 'idle' | 'capturing' | 'processing' | 'uploading' | 'complete' | 'error';

const DB_NAME = 'haefa-offline-photos';
const STORE_NAME = 'pending-uploads';

const PatientPhotoCapture: React.FC<PatientPhotoCaptureProps> = ({ patientId, onPhotoUploaded, currentPhoto }) => {
  const { selectedCountry, selectedClinic, notify } = useAppStore();
  const [state, setState] = useState<UIState>(currentPhoto ? 'complete' : 'idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto || null);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize IndexedDB
  const getDB = async () => {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'patientId' });
        }
      },
    });
  };

  // Check for pending uploads on mount or when online
  useEffect(() => {
    const checkPending = async () => {
      if (navigator.onLine && patientId && state !== 'uploading') {
        try {
          const db_idb = await getDB();
          const pending = await db_idb.get(STORE_NAME, patientId);
          if (pending) {
            notify("Resuming pending photo upload...", "info");
            handleUpload(pending.blob);
          }
        } catch (e) {
          console.error("IndexedDB error:", e);
        }
      }
    };

    window.addEventListener('online', checkPending);
    checkPending();
    return () => window.removeEventListener('online', checkPending);
  }, [patientId, state]);

  // Sync previewUrl with currentPhoto if it changes externally
  useEffect(() => {
    if (currentPhoto) {
      setPreviewUrl(currentPhoto);
      setState('complete');
    }
  }, [currentPhoto]);

  const compressImage = (file: File | Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimensions: 1024px
        const MAX_SIZE = 1024;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Compression failed"));
            }
          },
          'image/jpeg',
          0.7 // Quality: 0.7
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
    });
  };

  const handleUpload = async (blob: Blob) => {
    if (!patientId || !selectedCountry || !selectedClinic) {
      // If we don't have patientId yet, we'll store the blob and wait
      setCompressedBlob(blob);
      return;
    }

    setState('uploading');
    setProgress(0);
    setError(null);

    if (!storage) {
      setError("Firebase Storage is not initialized. Check your configuration.");
      setState('error');
      return;
    }

    // Path: patient_photos/{country}/{clinicId}/{patientId}/photo.jpg
    const path = `patient_photos/${selectedCountry.id}/${selectedClinic.id}/${patientId}/photo.jpg`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      async (err) => {
        console.error("Upload failed:", err);
        
        // Offline resilience
        if (!navigator.onLine || err.code === 'storage/retry-limit-exceeded' || err.code === 'storage/unauthorized') {
          try {
            const db_idb = await getDB();
            await db_idb.put(STORE_NAME, { patientId, blob, timestamp: Date.now() });
            setOfflineMessage("Photo saved locally. Will upload when connection resumes.");
            setState('idle');
          } catch (idbErr) {
            console.error("Failed to save to IndexedDB:", idbErr);
            setError("Upload failed and could not save locally.");
            setState('error');
          }
        } else {
          setError(`Upload failed: ${err.message}`);
          setState('error');
        }
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update Firestore: patients/{patientId} -> photo_url: downloadURL
          const patientRef = doc(db, "patients", patientId);
          try {
            await updateDoc(patientRef, { photo_url: downloadURL });
          } catch (updateErr: any) {
            // If document doesn't exist, it's likely a new registration.
            // The parent component will handle the initial setDoc.
            if (updateErr.code !== 'not-found') {
              throw updateErr;
            }
            console.log("Patient document not found, skipping immediate update (likely new registration)");
          }
          
          // Clear offline storage if it existed
          try {
            const db_idb = await getDB();
            await db_idb.delete(STORE_NAME, patientId);
          } catch (e) {}
          
          setPreviewUrl(downloadURL);
          setState('complete');
          setOfflineMessage(null);
          setCompressedBlob(null);
          if (onPhotoUploaded) onPhotoUploaded(downloadURL);
          notify("Photo uploaded successfully", "success");
        } catch (fsErr: any) {
          console.error("Post-upload process failed:", fsErr);
          // If Firestore update fails, we still have the URL
          setState('complete');
          setError(`Photo uploaded but record update failed: ${fsErr.message}`);
        }
      }
    );
  };

  // Effect to trigger upload when patientId becomes available
  useEffect(() => {
    if (patientId && compressedBlob && state !== 'uploading') {
      handleUpload(compressedBlob);
    }
  }, [patientId, compressedBlob]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Unsupported format. Please select an image.");
      setState('error');
      return;
    }

    setState('processing');
    setError(null);
    setOfflineMessage(null);

    try {
      const blob = await compressImage(file);
      
      // Max file size target: under 500 KB
      if (blob.size > 500 * 1024) {
        setError("File too large even after compression. Please try another photo.");
        setState('error');
        return;
      }

      // Use URL.createObjectURL for preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      
      if (patientId) {
        await handleUpload(blob);
      } else {
        setCompressedBlob(blob);
        setState('idle');
        notify("Photo captured. It will be uploaded once patient details are saved.", "info");
      }
    } catch (err: any) {
      console.error("Image processing failed:", err);
      setError(`Processing failed: ${err.message}`);
      setState('error');
    } finally {
      // Clear input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const triggerCapture = () => {
    cameraInputRef.current?.click();
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const clearPhoto = () => {
    setPreviewUrl(null);
    setCompressedBlob(null);
    setState('idle');
    setError(null);
    setOfflineMessage(null);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 2, 
      p: 2, 
      border: '1px solid', 
      borderColor: 'divider', 
      borderRadius: 4,
      bgcolor: 'background.paper',
      width: '100%',
      maxWidth: 400,
      mx: 'auto'
    }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        Patient Photo
      </Typography>

      <Box sx={{ position: 'relative' }}>
        <Avatar 
          src={previewUrl || undefined} 
          sx={{ 
            width: 120, 
            height: 120, 
            border: '3px solid', 
            borderColor: state === 'error' ? 'error.main' : 'primary.main',
            boxShadow: 3,
            bgcolor: 'grey.100',
            fontSize: '0.8rem',
            color: 'text.secondary'
          }}
        >
          {!previewUrl && "No Photo"}
        </Avatar>
        
        {(state === 'processing' || state === 'uploading') && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.7)',
            borderRadius: '50%',
            zIndex: 1
          }}>
            <CircularProgress size={40} variant={state === 'uploading' ? 'determinate' : 'indeterminate'} value={progress} />
          </Box>
        )}

        {previewUrl && state === 'complete' && (
          <IconButton 
            size="small" 
            onClick={clearPhoto}
            sx={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              bgcolor: 'error.main', 
              color: 'white',
              '&:hover': { bgcolor: 'error.dark' },
              boxShadow: 2
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {state === 'uploading' && (
        <Box sx={{ width: '100%', mt: 1 }}>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontWeight: 600 }}>
            Uploading... {Math.round(progress)}%
          </Typography>
        </Box>
      )}

      {state === 'processing' && (
        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
          Optimizing image...
        </Typography>
      )}

      {offlineMessage && (
        <Alert severity="warning" sx={{ width: '100%', py: 0 }}>
          {offlineMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ width: '100%', py: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
        <Button 
          fullWidth
          variant={previewUrl ? "outlined" : "contained"} 
          startIcon={previewUrl ? <RefreshIcon /> : <CameraIcon />} 
          onClick={triggerCapture}
          disabled={state === 'processing' || state === 'uploading'}
          sx={{ borderRadius: 2, py: 1 }}
        >
          {previewUrl ? "Retake" : "Take Photo"}
        </Button>
        
        {!previewUrl && (
          <Button 
            fullWidth
            variant="outlined" 
            startIcon={<UploadIcon />} 
            onClick={triggerUpload}
            disabled={state === 'processing' || state === 'uploading'}
            sx={{ borderRadius: 2, py: 1 }}
          >
            Device
          </Button>
        )}
      </Stack>

      <input 
        type="file" 
        hidden 
        accept="image/*" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      <input 
        type="file" 
        hidden 
        accept="image/*" 
        ref={cameraInputRef}
        onChange={handleFileChange}
        capture="environment"
      />
    </Box>
  );
};

export default PatientPhotoCapture;
