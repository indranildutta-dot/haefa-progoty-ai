import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { CountryConfig, ClinicConfig } from '../config/countries';
import { UserProfile, ClinicConfigDocument, Patient } from '../types';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  id: string;
}

interface AppState {
  // Auth
  user: User | null;
  userProfile: UserProfile | null;
  setUser: (user: User | null, profile?: UserProfile | null) => void;
  
  // Session
  selectedCountry: CountryConfig | null;
  selectedClinic: ClinicConfig | null;
  clinicConfig: ClinicConfigDocument | null;
  selectedPatient: Patient | null;
  setSession: (country: CountryConfig | null, clinic: ClinicConfig | null) => void;
  clearCountry: () => void;
  clearClinic: () => void;
  setClinicConfig: (config: ClinicConfigDocument | null) => void;
  setSelectedPatient: (patient: Patient | null) => void;
  
  // Notifications
  notifications: Notification[];
  notify: (message: string, type?: Notification['type']) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      userProfile: null,
      setUser: (user, profile = null) => set({ user, userProfile: profile }),
      
      selectedCountry: null,
      selectedClinic: null,
      clinicConfig: null,
      selectedPatient: null,
      setSession: (country, clinic) => set({ 
        selectedCountry: country, 
        selectedClinic: clinic 
      }),
      clearCountry: () => set({ selectedCountry: null, selectedClinic: null, selectedPatient: null }),
      clearClinic: () => set({ selectedClinic: null, selectedPatient: null }),
      setClinicConfig: (config) => set({ clinicConfig: config }),
      setSelectedPatient: (patient) => set({ selectedPatient: patient }),
      
      notifications: [],
      notify: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          notifications: [...state.notifications, { id, message, type }]
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
          }));
        }, 5000);
      },
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),
    }),
    {
      name: 'haefa-progoty-storage',
      partialize: (state) => ({ 
        selectedCountry: state.selectedCountry, 
        selectedClinic: state.selectedClinic 
      }),
    }
  )
);
