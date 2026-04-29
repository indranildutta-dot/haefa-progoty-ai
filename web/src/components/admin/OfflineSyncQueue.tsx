import React, { useState, useEffect } from 'react';
import { Grid, Box, Typography, Paper, Card, CardContent, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress, Divider } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DownloadIcon from '@mui/icons-material/Download';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import { useAppStore } from '../../../src/store/useAppStore';
import { syncClinicPatientsToLocalIndex, syncClinicalMetadataToLocalIndex, getLocalSyncStatus } from '../../services/localDataSync';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Patient } from '../../types';

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
  const { selectedClinic, notify } = useAppStore();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  const [offlineRegistrations, setOfflineRegistrations] = useState<Patient[]>([]);
  const [loadingOfflineRgs, setLoadingOfflineRgs] = useState(false);
  const [selectedOfflineReg, setSelectedOfflineReg] = useState<Patient | null>(null);

  useEffect(() => {
    if (selectedClinic) {
      getLocalSyncStatus(selectedClinic.id).then(status => {
        setLastSyncDate(status.patientListLastSync || null);
      });
      fetchOfflineRegistrations();
    }
  }, [selectedClinic]);

  const fetchOfflineRegistrations = async () => {
    if (!selectedClinic) return;
    setLoadingOfflineRgs(true);
    try {
       const q = query(collection(db, 'patients'), where('clinic_id', '==', selectedClinic.id), where('is_offline_registration', '==', true));
       const snap = await getDocs(q);
       setOfflineRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
    } catch(e) {
       console.error("Failed to fetch offline registrations", e);
    } finally {
       setLoadingOfflineRgs(false);
    }
  };

  const handleResolveOfflineReg = async (patientId: string) => {
    // Basic resolution merely removes the flag in this UI. A full merge would require search/merge tools.
    try {
      await updateDoc(doc(db, 'patients', patientId), { is_offline_registration: false });
      notify("Offline Registration Resolved.", "success");
      setOfflineRegistrations(prev => prev.filter(p => p.id !== patientId));
      setSelectedOfflineReg(null);
    } catch(e) {
      notify("Resolution failed.", "error");
    }
  };

  const handleManualSync = async () => {
    if (!selectedClinic) return;
    setIsSyncing(true);
    setSyncStatus('Starting sync...');
    try {
      await syncClinicPatientsToLocalIndex(selectedClinic.id, (msg) => setSyncStatus(msg));
      setSyncStatus('Syncing clinical metadata...');
      await syncClinicalMetadataToLocalIndex(selectedClinic.id);
      
      const newStatus = await getLocalSyncStatus(selectedClinic.id);
      setLastSyncDate(newStatus.patientListLastSync || null);
      notify("Offline database successfully updated", "success");
      setSyncStatus('Sync completed successfully!');
    } catch (e) {
      console.error(e);
      notify("Failed to sync offline database", "error");
      setSyncStatus('Sync failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

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
      {/* Offline Database Sync Controls */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ display: 'flex', alignItems: 'center' }}>
              <DownloadIcon sx={{ mr: 1 }} /> Offline Database Cache
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Download a lightweight, encrypted index of common patients and aggressively cache all patient photos to allow entirely offline search, visual identification, and matching when this tablet loses connection.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 'bold' }}>
              Last Synced: {lastSyncDate ? new Date(lastSyncDate).toLocaleString() : 'Never'}
            </Typography>
            {syncStatus && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main', fontWeight: 500 }}>
                {syncStatus}
              </Typography>
            )}
          </Box>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleManualSync}
            disabled={isSyncing || !selectedClinic}
            startIcon={isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
            sx={{ flexShrink: 0, borderRadius: 2, px: 3 }}
          >
            {isSyncing ? 'Syncing...' : 'Update Local Database'}
          </Button>
        </Box>
      </Paper>

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

      {/* Offline Registrations Section */}
      <Box sx={{ mt: 6, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          <AssignmentIndIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'text.secondary' }} />
          Offline Profiles Awaiting Reconciliation
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={fetchOfflineRegistrations} 
          disabled={loadingOfflineRgs}
        >
          {loadingOfflineRgs ? 'Loading...' : 'Refresh List'}
        </Button>
      </Box>

      {offlineRegistrations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6">No Offline Profiles</Typography>
          <Typography color="text.secondary">All patients have valid MoHA/National IDs and are fully reconciled.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {offlineRegistrations.map((patient) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={patient.id}>
               <Card sx={{ borderLeft: '4px solid', borderColor: '#ef4444' }}>
                 <CardContent>
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                     <Typography fontWeight="bold">{patient.given_name} {patient.family_name}</Typography>
                     <Chip size="small" label="Temp ID" color="error" />
                   </Box>
                   <Typography variant="body2" color="text.secondary" gutterBottom>
                     Created: {patient.created_at?.toDate().toLocaleDateString() || 'N/A'}
                   </Typography>
                   <Typography variant="body2" sx={{ my: 1.5, fontFamily: 'monospace' }}>
                     {patient.temporary_offline_id || 'UNKNOWN TEMPORARY ID'}
                   </Typography>
                   <Button 
                     variant="contained" 
                     color="primary" 
                     fullWidth
                     onClick={() => setSelectedOfflineReg(patient)}
                     sx={{ mt: 1 }}
                   >
                     Reconcile Profile
                   </Button>
                 </CardContent>
               </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Selected Offline Reg Dialog */}
      {selectedOfflineReg && (
        <Dialog open={!!selectedOfflineReg} onClose={() => setSelectedOfflineReg(null)} maxWidth="sm" fullWidth>
           <DialogTitle>Reconcile Offline Registration</DialogTitle>
           <DialogContent dividers>
             <Alert severity="info" sx={{ mb: 2 }}>
               To reconcile this profile, you should search the National Registry or merge this profile with an existing one. For now, you can mark it as resolved if it is fixed.
             </Alert>
             <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Patient Name</Typography>
                <Typography variant="body1" fontWeight="bold">{selectedOfflineReg.given_name} {selectedOfflineReg.family_name}</Typography>
             </Box>
             <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Temporary UUID generated locally</Typography>
                <Typography variant="body1" fontFamily="monospace">{selectedOfflineReg.temporary_offline_id}</Typography>
             </Box>
           </DialogContent>
           <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
             <Button onClick={() => setSelectedOfflineReg(null)}>Cancel</Button>
             <Button 
               variant="contained" 
               color="success" 
               onClick={() => handleResolveOfflineReg(selectedOfflineReg.id!)}
             >
               Mark Resolved
             </Button>
           </DialogActions>
        </Dialog>
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
