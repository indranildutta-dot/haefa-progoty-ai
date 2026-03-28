import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAppStore } from './store/useAppStore';

// Screens
import Login from './screens/Login';
import CountrySelection from './screens/CountrySelection';
import ClinicSelection from './screens/ClinicSelection';
import Dashboard from './screens/Dashboard';
import VitalsStation from './screens/VitalsStation';
import DoctorDashboard from './screens/DoctorDashboard';
import PharmacyStation from './screens/PharmacyStation';
import QueueBoard from './screens/QueueBoard';
import { CircularProgress, Box, Typography } from '@mui/material';

const App: React.FC = () => {
  const { 
    user, 
    userProfile, 
    setUser, 
    selectedCountry, 
    selectedClinic, 
    setSession,
    clearCountry 
  } = useAppStore();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUser(firebaseUser, docSnap.data() as any);
          } else {
            setUser(firebaseUser, null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(firebaseUser, null);
        }
      } else {
        setUser(null, null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser]);

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2, fontWeight: 900, color: 'primary.main' }}>VERIFYING CREDENTIALS...</Typography>
      </Box>
    );
  }

  // Helper for Route Guarding
  const IsAuthorized = () => {
    if (!user) return false;
    if (userProfile?.role === 'global_admin') return true;
    return userProfile?.isApproved === true;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/country-selection" />} />

        <Route path="/country-selection" element={
          user ? <CountrySelection /> : <Navigate to="/login" />
        } />

        <Route path="/clinic-selection" element={
          user && selectedCountry ? (
            <ClinicSelection 
              selectedCountry={selectedCountry}
              onSelectClinic={(clinic) => setSession(selectedCountry, clinic)}
              onBack={() => clearCountry()}
            />
          ) : <Navigate to="/country-selection" />
        } />

        {/* CLINICAL ROUTES - Require Login, Approved Profile, and Selected Clinic */}
        <Route path="/dashboard" element={
          IsAuthorized() && selectedClinic ? <Dashboard /> : <Navigate to="/clinic-selection" />
        } />

        <Route path="/vitals" element={
          IsAuthorized() && selectedClinic ? <VitalsStation countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
        } />

        <Route path="/doctor" element={
          IsAuthorized() && selectedClinic ? <DoctorDashboard countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
        } />

        <Route path="/pharmacy" element={
          IsAuthorized() && selectedClinic ? <PharmacyStation countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
        } />

        <Route path="/queue" element={
          IsAuthorized() && selectedClinic ? <QueueBoard countryId={selectedCountry?.id || ''} /> : <Navigate to="/clinic-selection" />
        } />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
};

export default App;