import React, { useState, useEffect } from 'react';
import { Grid, Box, Typography, Paper, Card, CardContent, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

interface SyncConflict {
  id: string;
  type: string;
  patientName: string;
  station: string;
  timeOffline: string;
  status: 'pending' | 'resolved';
  conflictReason?: string;
  localData?: any;
  serverData?: any;
}

export default function OfflineSyncQueue() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  // Mocking the detection of Workbox "Outbox" records or Firestore complex merge conflicts
  useEffect(() => {
    // In a real app, this would query a "sync_conflicts" collection 
    // populated by a Backend Cloud Function that detects concurrent offline updates
    setConflicts([
      {
        id: '1',
        type: 'Prescription Update',
        patientName: 'Rahima Begum',
        station: 'Doctor Station',
        timeOffline: '10:42 AM',
        status: 'pending',
        conflictReason: 'Two providers updated the prescription list offline simultaneously.',
        localData: { meds: ['Amoxicillin', 'Paracetamol'] },
        serverData: { meds: ['Amoxicillin', 'Azithromycin'] }
      },
      {
        id: '2',
        type: 'Vitals Overwrite',
        patientName: 'Ahmadullah',
        station: 'Vitals Station',
        timeOffline: '11:15 AM',
        status: 'pending',
        conflictReason: 'Stale offline data submitted over a newer network record.',
        localData: { bp: '140/90' },
        serverData: { bp: '135/85' }
      }
    ]);
  }, []);

  const handleResolve = (resolution: 'local' | 'server' | 'merge') => {
    if (!selectedConflict) return;
    setConflicts(prev => prev.map(c => c.id === selectedConflict.id ? { ...c, status: 'resolved' } : c));
    setSelectedConflict(null);
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          <CloudOffIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'text.secondary' }} />
          Offline Sync Queue & Conflicts
        </Typography>
        <Chip 
          icon={<SyncIcon />} 
          label={`${conflicts.filter(c => c.status === 'pending').length} Actions Required`} 
          color="warning" 
          variant="outlined" 
        />
      </Box>

      {conflicts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6">All Data Synced</Typography>
          <Typography color="text.secondary">No offline collisions or pending merges detected.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {conflicts.map((conflict) => (
            <Grid size={{ xs: 12, md: 6 }} key={conflict.id}>
              <Card sx={{ 
                borderLeft: '4px solid', 
                borderColor: conflict.status === 'pending' ? 'warning.main' : 'success.main',
                opacity: conflict.status === 'resolved' ? 0.6 : 1
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography fontWeight="bold">{conflict.patientName}</Typography>
                    <Chip size="small" label={conflict.status} color={conflict.status === 'pending' ? 'warning' : 'success'} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {conflict.station} • {conflict.timeOffline}
                  </Typography>
                  <Typography variant="body2" sx={{ my: 1.5, bgcolor: '#fff3cd', p: 1, borderRadius: 1 }}>
                    <strong>Issue:</strong> {conflict.conflictReason}
                  </Typography>
                  
                  {conflict.status === 'pending' && (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      startIcon={<CompareArrowsIcon />}
                      onClick={() => setSelectedConflict(conflict)}
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      Review & Resolve
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedConflict && (
        <Dialog open={!!selectedConflict} onClose={() => setSelectedConflict(null)} maxWidth="md" fullWidth>
          <DialogTitle>Resolve Sync Conflict: {selectedConflict.patientName}</DialogTitle>
          <DialogContent dividers>
            <Alert severity="warning" sx={{ mb: 3 }}>
              {selectedConflict.conflictReason}
            </Alert>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2, border: '2px solid #3b82f6' }}>
                  <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom>
                    Local Offline Data (This Device)
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <pre style={{ margin: 0 }}>{JSON.stringify(selectedConflict.localData, null, 2)}</pre>
                  </Box>
                  <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => handleResolve('local')}>
                    Keep Local Data
                  </Button>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2, border: '2px solid #10b981' }}>
                  <Typography variant="subtitle2" color="success.main" fontWeight="bold" gutterBottom>
                    Server Data (Cloud)
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <pre style={{ margin: 0 }}>{JSON.stringify(selectedConflict.serverData, null, 2)}</pre>
                  </Box>
                  <Button variant="outlined" color="success" fullWidth sx={{ mt: 2 }} onClick={() => handleResolve('server')}>
                    Keep Server Data
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedConflict(null)}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
