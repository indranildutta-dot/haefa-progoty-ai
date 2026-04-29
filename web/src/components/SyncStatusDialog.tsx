import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';

interface SyncStatusDialogProps {
  open: boolean;
  onClose: () => void;
}

const SyncStatusDialog: React.FC<SyncStatusDialogProps> = ({ open, onClose }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon /> 
          System Sync & Offline Status
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3, p: 2, bgcolor: isOnline ? '#e8f5e9' : '#ffebee', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          {isOnline ? (
            <CloudDoneIcon color="success" sx={{ fontSize: 40 }} />
          ) : (
            <CloudOffIcon color="error" sx={{ fontSize: 40 }} />
          )}
          <Box>
            <Typography variant="h6" color={isOnline ? 'success.main' : 'error.main'}>
              {isOnline ? 'You are Online' : 'You are Offline'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isOnline 
                ? 'All clinical records will be synced to the secure server in real-time.' 
                : 'Connection lost. You can continue working. Records are saved locally and will sync when connection is restored.'
              }
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Offline Capabilities Active
        </Typography>
        <List disablePadding>
          <ListItem sx={{ px: 0 }}>
            <ListItemIcon><InstallMobileIcon color="primary" /></ListItemIcon>
            <ListItemText 
              primary="App Installation & Caching" 
              secondary="The application core (UI, styles, images) is cached. The app will load even without internet." 
            />
          </ListItem>
          <ListItem sx={{ px: 0 }}>
            <ListItemIcon><SyncIcon color="secondary" /></ListItemIcon>
            <ListItemText 
              primary="Background Sync (Workbox)" 
              secondary="Data syncing managed directly by the tablet's Service Worker. Form submissions and queue updates are uploaded as soon as Wi-Fi is detected, even if the App tab is fully closed." 
            />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SyncStatusDialog;
