import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Chip,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import { 
  Logout, 
  AccountCircle, 
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Straighten as StraightenIcon,
  MonitorHeart as MonitorHeartIcon,
  Science as ScienceIcon,
  AssignmentInd as AssignmentIndIcon,
  ViewQuilt as ViewQuiltIcon,
  History as HistoryIcon,
  ContactSupport as SupportIcon
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { logout } from '../services/authService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const TopNavigation: React.FC = () => {
  const { selectedCountry, selectedClinic, clearCountry, clearClinic, user, userProfile, setUser } = useAppStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isMobile, isTablet } = useResponsiveLayout();
  const location = useLocation();

  // Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileRegNo, setProfileRegNo] = useState('');
  const [profileBody, setProfileBody] = useState('');
  const [profileDesignation, setProfileDesignation] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleOpenProfileModal = () => {
    setProfileName(userProfile?.name || '');
    setProfileRegNo(userProfile?.professional_reg_no || '');
    setProfileBody(userProfile?.professional_body || 'BMDC');
    setProfileDesignation(userProfile?.designation || 'Medical Officer');
    setProfileMessage(null);
    setProfileOpen(true);
    setAnchorEl(null);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      setProfileMessage({ type: 'error', text: 'Full Name is required.' });
      return;
    }
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          name: profileName.trim(),
          professional_reg_no: profileRegNo.trim(),
          professional_body: profileBody.trim(),
          designation: profileDesignation.trim(),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        setUser(user, {
          ...userProfile,
          uid: user.uid,
          email: user.email || '',
          isApproved: userProfile?.isApproved ?? true,
          role: userProfile?.role ?? 'doctor',
          name: profileName.trim(),
          professional_reg_no: profileRegNo.trim(),
          professional_body: profileBody.trim(),
          designation: profileDesignation.trim()
        } as any);

        setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => setProfileOpen(false), 1200);
      }
    } catch (error: any) {
      console.error(error);
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setAnchorEl(null);
  };

  if (!user || !selectedCountry) return null;

  const isAdmin = userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin';

  const navItems = [
    ...(isAdmin ? [{ label: 'Admin Dashboard', to: '/admin', icon: <AssessmentIcon /> }] : []),
    ...(selectedClinic ? [
      { label: 'Operations', to: '/dashboard', icon: <DashboardIcon /> },
      { label: 'Registration', to: '/registration', icon: <PersonAddIcon /> },
      { label: 'Body Measures', to: '/vitals-1', icon: <StraightenIcon /> },
      { label: 'Vital Signs', to: '/vitals-2', icon: <MonitorHeartIcon /> },
      { label: 'Labs & Risk', to: '/labs-and-risk', icon: <ScienceIcon /> },
      { label: 'Doctor', to: '/doctor', icon: <AssignmentIndIcon /> },
      { label: 'Pharmacy', to: '/pharmacy', icon: <MedicationIcon /> },
      { label: 'Patient History', to: '/patient-history', icon: <HistoryIcon /> },
      { label: 'Queue Board', to: '/queue', icon: <ViewQuiltIcon /> },
    ] : []),
    { label: 'Support', to: '/support', icon: <SupportIcon /> }
  ];

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event &&
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const drawer = (
    <Box
      sx={{ width: 280 }}
      role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6" fontWeight="900" sx={{ mb: 0.5 }}>HAEFA PROGOTY</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>{user.email}</Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1, py: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton 
              component={NavLink} 
              to={item.to}
              selected={location.pathname === item.to}
              sx={{ 
                borderRadius: 2,
                minHeight: '48px',
                '&.active': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'inherit' }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, minHeight: '48px' }}>
            <ListItemIcon sx={{ minWidth: 40 }}><Logout color="error" /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 700, color: 'error.main' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white', color: 'text.primary' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 64 }}>
          {(isMobile || isTablet) && (
            <IconButton
              color="primary"
              aria-label="open drawer"
              edge="start"
              onClick={toggleDrawer(true)}
              sx={{ 
                mr: 2, 
                p: 1.5,
                bgcolor: 'primary.main',
                color: 'white',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <MenuIcon sx={{ fontSize: '2.2rem' }} />
            </IconButton>
          )}

          <Box component={NavLink} to="/" sx={{ display: 'flex', alignItems: 'center', mr: 3, textDecoration: 'none' }}>
            <Typography
              variant="h6"
              noWrap
              sx={{ 
                fontWeight: 900, 
                letterSpacing: '-0.02em', 
                color: 'primary.main',
                fontSize: isMobile ? '1.1rem' : '1.25rem'
              }}
            >
              HAEFA PROGOTY
            </Typography>
          </Box>
          
          {!isMobile && !isTablet && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3, borderRight: '1px solid rgba(0,0,0,0.08)', pr: 3 }}>
              <Chip 
                label={`${selectedCountry.name} ${selectedCountry.flag}`} 
                onClick={clearCountry}
                sx={{ fontWeight: 800, cursor: 'pointer', bgcolor: 'primary.light', color: 'primary.contrastText', px: 1 }}
                size="small"
              />
              {selectedClinic && (
                <Chip 
                  label={selectedClinic.name} 
                  onClick={clearClinic}
                  sx={{ fontWeight: 800, cursor: 'pointer', bgcolor: 'secondary.light', color: 'secondary.contrastText', px: 1 }}
                  size="small"
                  color="secondary"
                />
              )}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {!isMobile && !isTablet && (
            <Box sx={{ display: 'flex', gap: 0.5, mr: 2 }}>
              {navItems.map((item) => (
                <Button 
                  key={item.to}
                  component={NavLink} 
                  to={item.to} 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'text.secondary',
                    borderRadius: 2,
                    px: 2,
                    '&.active': { 
                      color: 'primary.main', 
                      bgcolor: 'rgba(15, 23, 42, 0.04)',
                    }
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title="Help & Support Desk">
              <IconButton 
                component={NavLink} 
                to="/support" 
                sx={{ 
                  color: location.pathname === '/support' ? 'primary.main' : 'text.secondary',
                  bgcolor: location.pathname === '/support' ? 'rgba(15, 23, 42, 0.04)' : 'transparent',
                  p: 1,
                  '&:hover': {
                    bgcolor: 'rgba(15, 23, 42, 0.08)'
                  }
                }}
              >
                <SupportIcon sx={{ fontSize: 26 }} />
              </IconButton>
            </Tooltip>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <AccountCircle sx={{ fontSize: 32 }} />
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              sx={{ mt: 1 }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem disabled>
                <Typography variant="body2" fontWeight="700">{user.email}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleOpenProfileModal}>
                <AccountCircle fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                Edit Clinician Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </Container>

      <SwipeableDrawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        onOpen={toggleDrawer(true)}
        disableBackdropTransition={!isMobile}
        disableDiscovery={isMobile}
      >
        {drawer}
      </SwipeableDrawer>

      {/* Edit Clinician Profile Dialog */}
      <Dialog 
        open={profileOpen} 
        onClose={() => !profileSaving && setProfileOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          Clinician Profile Credentials
          <Typography variant="body2" color="text.secondary">
            Keep your professional registration details up to date for prescriptions and auditing.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {profileMessage && (
            <Alert severity={profileMessage.type} sx={{ mb: 3, borderRadius: 2 }}>
              {profileMessage.text}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Full Name (for Prescriptions)"
              required
              fullWidth
              variant="outlined"
              placeholder="Dr. John Doe"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={profileSaving}
              helperText="This name will appear on active prescriptions and clinical audit logs."
            />
            
            <TextField
              label="Professional Registration Body"
              fullWidth
              variant="outlined"
              placeholder="BMDC, PCB, etc."
              value={profileBody}
              onChange={(e) => setProfileBody(e.target.value)}
              disabled={profileSaving}
              helperText="E.g., BMDC (Bangladesh Medical and Dental Council) or PCB for pharmacists."
            />

            <TextField
              label="Professional Registration Number (Reg No)"
              fullWidth
              variant="outlined"
              placeholder="E.g. A-12345"
              value={profileRegNo}
              onChange={(e) => setProfileRegNo(e.target.value)}
              disabled={profileSaving}
              helperText="Required for validation Stamps on dispensed/printed prescriptions."
            />

            <TextField
              label="Professional Designation"
              fullWidth
              variant="outlined"
              placeholder="Medical Officer, Consulting Cardologist, Dispenser"
              value={profileDesignation}
              onChange={(e) => setProfileDesignation(e.target.value)}
              disabled={profileSaving}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            onClick={() => setProfileOpen(false)} 
            disabled={profileSaving}
            sx={{ fontWeight: 'bold' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProfile} 
            variant="contained" 
            disabled={profileSaving}
            sx={{ fontWeight: 'bold', px: 3, borderRadius: 2 }}
          >
            {profileSaving ? 'Saving...' : 'Update Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
};

export default TopNavigation;
