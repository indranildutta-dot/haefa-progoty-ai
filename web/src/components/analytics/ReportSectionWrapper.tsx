import React, { useState } from 'react';
import { 
  Paper, 
  Box, 
  Typography, 
  IconButton, 
  Popover, 
  Divider,
  Stack
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface ReportSectionWrapperProps {
  title: string;
  subtitle?: string;
  description: string;
  children: React.ReactNode;
  color?: string;
}

const ReportSectionWrapper: React.FC<ReportSectionWrapperProps> = ({ title, subtitle, description, children, color = '#1e293b' }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid #e2e8f0', height: '100%', bgcolor: 'white', position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} color={color}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', textTransform: 'uppercase' }}>{subtitle}</Typography>}
        </Box>
        <IconButton onClick={handleClick} size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'primary.50' } }}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 3 }} />
      
      {children}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { p: 3, maxWidth: 350, borderRadius: 3, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }
        }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={900} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlinedIcon fontSize="small" />
            UNDERSTANDING THIS REPORT
          </Typography>
          <Divider />
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {description}
          </Typography>
        </Stack>
      </Popover>
    </Paper>
  );
};

export default ReportSectionWrapper;
