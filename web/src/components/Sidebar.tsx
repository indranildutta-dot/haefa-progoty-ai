import React from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Toolbar, 
  Divider,
  Box,
  Typography
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MedicationIcon from '@mui/icons-material/Medication';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { UserProfile } from '../types';

const drawerWidth = 240;

interface SidebarProps {
  user: UserProfile | null;
  mobileOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, mobileOpen, onClose }) => {
  const getMenuItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'registration':
        return [
          { text: 'Patient Registration', icon: <PeopleIcon />, path: 'registration' },
          { text: 'Patient Lookup', icon: <SearchIcon />, path: 'lookup' },
          { text: 'Queue Overview', icon: <ListAltIcon />, path: 'queue' },
        ];
      case 'nurse':
        return [
          { text: 'Vitals Station', icon: <LocalHospitalIcon />, path: 'vitals' },
          { text: 'Waiting Patients', icon: <PeopleIcon />, path: 'waiting' },
          { text: 'Queue Overview', icon: <ListAltIcon />, path: 'queue' },
        ];
      case 'doctor':
        return [
          { text: 'Doctor Dashboard', icon: <DashboardIcon />, path: 'doctor' },
          { text: 'Consultation Queue', icon: <AssignmentIcon />, path: 'consultation' },
          { text: 'Patient History Search', icon: <HistoryIcon />, path: 'history' },
        ];
      case 'pharmacy':
        return [
          { text: 'Pharmacy Queue', icon: <MedicationIcon />, path: 'pharmacy' },
          { text: 'Dispense Medication', icon: <MedicationIcon />, path: 'dispense' },
          { text: 'Completed Prescriptions', icon: <AssignmentIcon />, path: 'completed' },
        ];
      case 'admin':
        return [
          { text: 'System Dashboard', icon: <DashboardIcon />, path: 'admin' },
          { text: 'Analytics', icon: <AssessmentIcon />, path: 'analytics' },
          { text: 'Clinic Settings', icon: <SettingsIcon />, path: 'settings' },
        ];
      default:
        return [{ text: 'Dashboard', icon: <DashboardIcon />, path: 'dashboard' }];
    }
  };

  const menuItems = getMenuItems();

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ letterSpacing: 1 }}>
          CLINICAL WORKFLOW
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ flexGrow: 1, overflow: 'auto', py: 2 }}>
        <List sx={{ px: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton 
                sx={{ 
                  borderRadius: 2,
                  '&:hover': { backgroundColor: 'primary.light', '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: 'primary.contrastText' } }
                }}
              >
                <ListItemIcon sx={{ color: 'primary.main', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }} 
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="textSecondary">
          v1.0.0-beta
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, border: 'none', boxShadow: 4 },
        }}
      >
        {drawer}
      </Drawer>
      
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth, 
            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
            backgroundColor: '#fff'
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
