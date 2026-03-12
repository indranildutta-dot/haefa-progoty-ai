import React, { useState, useRef } from 'react';
import { Box, Button, Typography, Modal, IconButton } from '@mui/material';
import CameraIcon from '@mui/icons-material/CameraAlt';
import UploadIcon from '@mui/icons-material/Upload';
import Webcam from 'react-webcam';

interface PatientPhotoCaptureProps {
  onPhotoCapture: (photo: string | File) => void;
  currentPhoto?: string;
}

const PatientPhotoCapture: React.FC<PatientPhotoCaptureProps> = ({ onPhotoCapture, currentPhoto }) => {
  const [openCamera, setOpenCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onPhotoCapture(imageSrc);
      setOpenCamera(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onPhotoCapture(event.target.files[0]);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
      <Box sx={{ width: 150, height: 150, borderRadius: '50%', overflow: 'hidden', bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentPhoto && currentPhoto !== "" ? (
          <img src={currentPhoto} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Typography color="textSecondary">No Photo</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" startIcon={<CameraIcon />} onClick={() => setOpenCamera(true)}>Take Photo</Button>
        <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
          Upload
          <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
        </Button>
      </Box>

      <Modal open={openCamera} onClose={() => setOpenCamera(false)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'background.paper', p: 2, borderRadius: 2 }}>
          <Webcam 
            audio={false} 
            ref={webcamRef} 
            screenshotFormat="image/jpeg" 
            videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
          />
          <Button fullWidth variant="contained" onClick={capture} sx={{ mt: 2 }}>Capture</Button>
        </Box>
      </Modal>
    </Box>
  );
};

export default PatientPhotoCapture;
