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
  Chip
} from '@mui/material';
import { Logout, AccountCircle } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { logout } from '../services/authService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const TopNavigation: React.FC = () => {
  const { selectedCountry, selectedClinic, clearCountry, clearClinic, user } = useAppStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { isMobile } = useResponsiveLayout();

  const handleLogout = async () => {
    await logout();
    setAnchorEl(null);
  };

  if (!user || !selectedCountry || !selectedClinic) return null;

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white', color: 'text.primary' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 60, flexWrap: isMobile ? 'wrap' : 'nowrap', py: isMobile ? 1 : 0 }}>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ mr: 3, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main', flexGrow: isMobile ? 1 : 0 }}
          >
            HAEFA PROGOTY
          </Typography>
          
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3, borderRight: '1px solid rgba(0,0,0,0.08)', pr: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>Context:</Typography>
              <Chip 
                label={`${selectedCountry.name} ${selectedCountry.flag}`} 
                onClick={clearCountry}
                sx={{ fontWeight: 600, cursor: 'pointer', bgcolor: 'grey.100' }}
                size="small"
              />
              <Chip 
                label={selectedClinic.name} 
                onClick={clearClinic}
                sx={{ fontWeight: 600, cursor: 'pointer', bgcolor: 'grey.100' }}
                size="small"
                color="secondary"
              />
            </Box>
          )}

          <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5, overflowX: 'auto', pb: isMobile ? 1 : 0 }}>
            {[
              { label: 'Ops', to: '/admin' },
              { label: 'Reg', to: '/' },
              { label: 'Vitals', to: '/vitals' },
              { label: 'Doctor', to: '/doctor' },
              { label: 'Pharmacy', to: '/pharmacy' },
              { label: 'Queue', to: '/queue' },
            ].map((item) => (
              <Button 
                key={item.to}
                component={Link} 
                to={item.to} 
                size={isMobile ? "small" : "medium"}
                sx={{ 
                  fontWeight: 600, 
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  '&.active': { color: 'primary.main', bgcolor: 'grey.100' }
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', gap: 1, borderLeft: !isMobile ? '1px solid rgba(0,0,0,0.08)' : 'none', pl: !isMobile ? 2 : 0 }}>
            {!isMobile && <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.email?.split('@')[0]}</Typography>}
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                <AccountCircle />
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              sx={{ mt: 1 }}
            >
              <MenuItem disabled>
                <Typography variant="body2">{user.email}</Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default TopNavigation;
