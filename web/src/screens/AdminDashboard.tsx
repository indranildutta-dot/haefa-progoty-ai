import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Divider,
  Container
} from '@mui/material';
import { Link } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { collection, query, where, getDocs, count, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

interface AdminDashboardProps {
  countryId: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic, notify } = useAppStore();
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeEncounters: 0,
    completedToday: 0
  });

  const handleSeedMedications = async () => {
    try {
      const meds = [
        { name: "amoxicillin", maxDailyDose: 3000, unit: "mg" },
        { name: "ibuprofen", maxDailyDose: 3200, unit: "mg" },
        { name: "paracetamol", maxDailyDose: 4000, unit: "mg" },
        { name: "lisinopril", maxDailyDose: 40, unit: "mg" },
        { name: "aspirin", maxDailyDose: 4000, unit: "mg" },
        { name: "warfarin", maxDailyDose: 10, unit: "mg" }
      ];

      for (const m of meds) {
        await addDoc(collection(db, "medications"), m);
      }

      const interactions = [
        {
          medication1Name: "ibuprofen",
          medication2Name: "aspirin",
          severity: "high",
          description: "Increased risk of bleeding and gastrointestinal toxicity."
        },
        {
          medication1Name: "warfarin",
          medication2Name: "aspirin",
          severity: "high",
          description: "Significantly increased risk of severe bleeding."
        }
      ];

      for (const i of interactions) {
        await addDoc(collection(db, "drug_interactions"), i);
      }

      notify("Medications and interactions seeded successfully!", "success");
    } catch (err) {
      console.error(err);
      notify("Failed to seed medications", "error");
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!selectedCountry || !selectedClinic) return;
        
        const patientsRef = collection(db, "patients");
        const pQuery = query(
          patientsRef, 
          where("country_code", "==", selectedCountry.id),
          where("clinic_id", "==", selectedClinic.id)
        );
        const pSnapshot = await getDocs(pQuery);
        
        const queueRef = collection(db, "queue");
        const qQuery = query(
          queueRef, 
          where("country_code", "==", selectedCountry.id),
          where("clinic_id", "==", selectedClinic.id)
        );
        const qSnapshot = await getDocs(qQuery);
        const activeCount = qSnapshot.docs.filter(doc => 
          ["WAITING_FOR_VITALS", "READY_FOR_DOCTOR", "WAITING_FOR_PHARMACY"].includes(doc.data().status)
        ).length;

        setStats({
          totalPatients: pSnapshot.size,
          activeEncounters: activeCount,
          completedToday: 0 // Placeholder
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    fetchStats();
  }, [countryId]);

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" fontWeight="800">{value}</Typography>
        <Typography variant="body2" color="text.secondary" fontWeight="600">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.02em' }}>
            ADMIN DASHBOARD
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Clinic Overview & Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handleSeedMedications}
            sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 'bold' }}
          >
            Seed Medications
          </Button>
          <Button 
            variant="contained" 
            component={Link} 
            to="/queue" 
            startIcon={<ListAltIcon />}
            sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 'bold' }}
          >
            Open Queue Board
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Total Registered Patients" value={stats.totalPatients} icon={<PeopleIcon />} color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Active in Queue" value={stats.activeEncounters} icon={<ListAltIcon />} color="secondary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Completed Today" value={stats.completedToday} icon={<AssessmentIcon />} color="success" />
        </Grid>
      </Grid>

      <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Typography variant="h6" fontWeight="800" gutterBottom>
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Registration
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/vitals" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Vitals Station
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/doctor" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Doctor Dashboard
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/pharmacy" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Pharmacy Station
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
