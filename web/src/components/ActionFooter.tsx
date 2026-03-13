import React from 'react';
import { Box, Paper, Container } from '@mui/material';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface ActionFooterProps {
  children: React.ReactNode;
}

const ActionFooter: React.FC<ActionFooterProps> = ({ children }) => {
  const { isMobile } = useResponsiveLayout();

  return (
    <Paper 
      elevation={4} 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1100,
        bgcolor: 'white',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        py: 1.5
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 2,
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          {children}
        </Box>
      </Container>
    </Paper>
  );
};

export default ActionFooter;
