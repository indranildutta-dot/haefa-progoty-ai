import { useTheme, useMediaQuery } from '@mui/material';

export type Orientation = 'portrait' | 'landscape';

export const useResponsiveLayout = () => {
  const theme = useTheme();
  
  // Breakpoints:
  // Phone: 360px – 600px (MUI sm is 600)
  // Tablet: 768px – 1024px (MUI lg is 1200)
  // Desktop: 1200px+
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); 
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const orientation: Orientation = isPortrait ? 'portrait' : 'landscape';

  return {
    isMobile,
    isTablet,
    isDesktop,
    orientation,
  };
};
