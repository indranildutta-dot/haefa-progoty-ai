import React from 'react';
import { 
  Paper, 
  Grid, 
  Box, 
  Typography, 
  TextField, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Select,
  Stack,
  Button,
  IconButton
} from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RefreshIcon from '@mui/icons-material/Refresh';

export interface FilterState {
  dateRange: [string | null, string | null];
  countryId: string;
  clinicId: string;
  nationality: string;
  ageGroup: string;
  sex: string;
  visitStatus: string;
}

interface AnalyticsFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ filters, onFilterChange }) => {
  const handleChange = (field: keyof FilterState, value: any) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    onFilterChange({
      dateRange: [null, null],
      countryId: 'all',
      clinicId: 'all',
      nationality: 'all',
      ageGroup: 'all',
      sex: 'all',
      visitStatus: 'all'
    });
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 4, mb: 3, border: '1px solid #e2e8f0' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterAltIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>GLOBAL DATA SLICERS</Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            type="date"
            label="From Date"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            size="small"
            value={filters.dateRange[0] || ''}
            onChange={(e) => handleChange('dateRange', [e.target.value, filters.dateRange[1]])}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            type="date"
            label="To Date"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            size="small"
            value={filters.dateRange[1] || ''}
            onChange={(e) => handleChange('dateRange', [filters.dateRange[0], e.target.value])}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Country</InputLabel>
            <Select
              value={filters.countryId}
              label="Country"
              onChange={(e) => handleChange('countryId', e.target.value)}
            >
              <MenuItem value="all">All Countries</MenuItem>
              <MenuItem value="BD">Bangladesh</MenuItem>
              <MenuItem value="NP">Nepal</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Clinic Location</InputLabel>
            <Select
              value={filters.clinicId}
              label="Clinic Location"
              onChange={(e) => handleChange('clinicId', e.target.value)}
            >
              <MenuItem value="all">All Clinics (Global)</MenuItem>
              <MenuItem value="dhaka-main">Dhaka Main</MenuItem>
              <MenuItem value="cox-bazar">Cox's Bazar</MenuItem>
              <MenuItem value="kutupalong">Kutupalong Camp</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Nationality</InputLabel>
            <Select
              value={filters.nationality}
              label="Nationality"
              onChange={(e) => handleChange('nationality', e.target.value)}
            >
              <MenuItem value="all">All Groups</MenuItem>
              <MenuItem value="rohingya">Rohingya (FDMN)</MenuItem>
              <MenuItem value="host">Host Population</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Age Group</InputLabel>
            <Select
              value={filters.ageGroup}
              label="Age Group"
              onChange={(e) => handleChange('ageGroup', e.target.value)}
            >
              <MenuItem value="all">All Ages</MenuItem>
              <MenuItem value="pediatric">Pediatric (&lt; 18)</MenuItem>
              <MenuItem value="adult">Adult (18-64)</MenuItem>
              <MenuItem value="geriatric">Geriatric (65+)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Sex</InputLabel>
            <Select
              value={filters.sex}
              label="Sex"
              onChange={(e) => handleChange('sex', e.target.value)}
            >
              <MenuItem value="all">Any</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button 
            fullWidth 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={handleReset}
            sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '40px', fontWeight: 700 }}
          >
            RESET FILTERS
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AnalyticsFilters;
