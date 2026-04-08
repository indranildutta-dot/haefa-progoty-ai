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
  Divider
} from '@mui/material';
import { 
  Logout, 
  AccountCircle, 
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { logout } from '../services/authService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const TopNavigation: React.FC = () => {
  const { selectedCountry, selectedClinic, clearCountry, clearClinic, user, userProfile } = useAppStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isMobile, isTablet } = useResponsiveLayout();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    setAnchorEl(null);
  };

  if (!user || !selectedCountry) return null;

  const isAdmin = userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin';

  const navItems = [
    ...(isAdmin ? [{ label: 'Operations', to: '/admin', icon: <DashboardIcon /> }] : []),
    ...(selectedClinic ? [
      { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon /> },
      { label: 'Registration', to: '/registration', icon: <PersonAddIcon /> },
      { label: 'Body Measures', to: '/vitals-1', icon: <LocalHospitalIcon /> },
      { label: 'Vital Signs', to: '/vitals-2', icon: <LocalHospitalIcon /> },
      { label: 'Labs & Risk', to: '/labs-and-risk', icon: <LocalHospitalIcon /> },
      { label: 'Doctor', to: '/doctor', icon: <MedicationIcon /> },
      { label: 'Pharmacy', to: '/pharmacy', icon: <MedicationIcon /> },
      { label: 'Queue Board', to: '/queue', icon: <PeopleIcon /> },
    ] : []),
    ...(isAdmin ? [{ label: 'Users', to: '/admin/users', icon: <PeopleIcon /> }] : []),
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

          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
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
    </AppBar>
  );
};

export default TopNavigation;
