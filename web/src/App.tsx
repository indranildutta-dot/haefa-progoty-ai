import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { getUserProfile, subscribeToAuthChanges } from './services/authService';

// FULL SCREEN IMPORTS - Matches your File Explorer exactly
import LandingPage from './screens/LandingPage';
import LoginPage from './screens/LoginPage'; 
import ClinicSelection from './screens/ClinicSelection';
import ClinicOperationsDashboard from './screens/ClinicOperationsDashboard'; // FIXED: Added 's' to match filename
import RegistrationStation from './screens/RegistrationStation';
import VitalsStation from './screens/VitalsStation';
import DoctorStation from './screens/DoctorStation';
import PharmacyStation from './screens/PharmacyStation';
import PatientHistory from './screens/PatientHistory';
import QueueBoard from './screens/QueueBoard';
import AdminUserManagement from './screens/AdminUserManagement';
import AdminDashboard from './screens/AdminDashboard';
import AdvancedAnalytics from './screens/AdvancedAnalytics';

import { CircularProgress, Box, Typography, Container, Paper } from '@mui/material';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import { processOfflineQueue } from './services/backgroundRetryQueue';

const App: React.FC = () => {
  const { user, userProfile, setUser, selectedCountry, selectedClinic, clearCountry, setSession } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * CORE AUTHENTICATION BRIDGE
   * Listens to Firebase Auth changes and immediately fetches the 
   * Firestore RBAC profile (assignedClinics, role, isApproved).
   */
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const profile = await getUserProfile(firebaseUser.uid, firebaseUser.email);
          setUser(firebaseUser, profile);
        } else {
          setUser(null, null);
        }
        setAuthError(null);
      } catch (err) {
        console.error("Critical Auth/Profile Sync Error:", err);
        setAuthError("Failed to synchronize your medical profile. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser]);

  // Loading State - Branded UI
  if (loading) return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh" bgcolor="#f8fafc">
      <CircularProgress size={50} thickness={4} />
      <Typography sx={{ mt: 3, fontWeight: 900, color: 'primary.main', letterSpacing: '0.1em' }}>
        VERIFYING CLINICAL SESSION...
      </Typography>
    </Box>
  );

  // Error State - If profile fetch fails
  if (authError) return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4, border: '2px solid #ef4444' }}>
        <Typography variant="h6" color="error" fontWeight="900" gutterBottom>CONNECTION ERROR</Typography>
        <Typography variant="body2" color="text.secondary">{authError}</Typography>
        <Box sx={{ mt: 3 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontWeight: 900, borderRadius: '8px', cursor: 'pointer' }}>
            RETRY CONNECTION
          </button>
        </Box>
      </Paper>
    </Container>
  );

  /**
   * AUTHORIZATION GUARD
   * Logic: Global Admins (Indranil) bypass approval. Others (Nurses) must be isApproved: true.
   */
  const isAuthorized = () => {
    if (!user || !userProfile) return false;
    if (userProfile.role === 'global_admin') return true;
    return userProfile.isApproved === true;
  };

  return (
    <>
      <NetworkStatusIndicator />
      <Routes>
        {/* STEP 1: GLOBAL LANDING & COUNTRY SELECTION */}
      <Route path="/" element={<LandingPage />} />

      {/* STEP 2: LOGIN - Guarded by Country Selection */}
      <Route path="/login" element={
        selectedCountry ? (
          !user ? <LoginPage selectedCountry={selectedCountry} onBack={() => clearCountry()} /> : <Navigate to="/clinic-selection" />
        ) : <Navigate to="/" />
      } />

      {/* STEP 3: CLINIC SELECTION - Guarded by Auth & Country */}
      <Route path="/clinic-selection" element={
        user && selectedCountry ? (
          <ClinicSelection 
            selectedCountry={selectedCountry} 
            onSelectClinic={(clinic) => setSession(selectedCountry, clinic)} 
            onBack={() => clearCountry()} 
          />
        ) : <Navigate to="/login" />
      } />

      {/* STEP 4: PROTECTED CLINICAL STATIONS (Requires Authorized Profile + Active Clinic Session) */}
      <Route path="/dashboard" element={
        isAuthorized() && selectedClinic ? <ClinicOperationsDashboard countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/registration" element={
        isAuthorized() && selectedClinic ? <RegistrationStation countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/vitals-1" element={
        isAuthorized() && selectedClinic ? <VitalsStation countryId={selectedCountry?.id || ''} mode={1} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/vitals-2" element={
        isAuthorized() && selectedClinic ? <VitalsStation countryId={selectedCountry?.id || ''} mode={2} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/labs-and-risk" element={
        isAuthorized() && selectedClinic ? <VitalsStation countryId={selectedCountry?.id || ''} mode={3} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/doctor" element={
        isAuthorized() && selectedClinic ? <DoctorStation countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/pharmacy" element={
        isAuthorized() && selectedClinic ? <PharmacyStation countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/patient-history" element={
        isAuthorized() && selectedClinic ? <PatientHistory /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/queue" element={
        isAuthorized() && selectedClinic ? <QueueBoard countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
      } />

      <Route path="/users" element={
        userProfile?.role === 'global_admin' ? <AdminUserManagement /> : <Navigate to="/" />
      } />

      <Route path="/analytics" element={
        isAuthorized() ? <AdvancedAnalytics /> : <Navigate to="/" />
      } />

      <Route path="/admin" element={
        userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin' ? <AdminDashboard /> : <Navigate to="/" />
      } />

      {/* CATCH-ALL REDIRECT */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  );
};

export default App;