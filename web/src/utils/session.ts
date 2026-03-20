import { useAppStore } from '../store/useAppStore';

export const getSession = () => {
  const { selectedCountry, selectedClinic, userProfile } = useAppStore.getState();
  const isAdmin = userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin';
  if (!selectedCountry || !selectedClinic) throw new Error("Session not initialized");
  return { selectedCountry, selectedClinic, isAdmin };
};
