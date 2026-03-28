import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { CountryConfig, ClinicConfig } from '../config/countries';
import { UserProfile, Patient } from '../types';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  id: string;
}

interface AppState {
  user: User | null;
  userProfile: UserProfile | null;
  setUser: (user: User | null, profile?: UserProfile | null) => void;
  
  selectedCountry: CountryConfig | null;
  selectedClinic: ClinicConfig | null;
  selectedPatient: Patient | null;
  
  setSelectedCountry: (country: CountryConfig | null) => void;
  setSession: (country: CountryConfig | null, clinic: ClinicConfig | null) => void;
  clearCountry: () => void;
  clearClinic: () => void;
  setSelectedPatient: (patient: Patient | null) => void;
  
  notifications: Notification[];
  notify: (message: string, type?: Notification['type']) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      userProfile: null,
      setUser: (user, profile = null) => set({ user, userProfile: profile }),
      
      selectedCountry: null,
      selectedClinic: null,
      selectedPatient: null,

      setSelectedCountry: (country) => set({ selectedCountry: country }),
      
      setSession: (country, clinic) => set({ 
        selectedCountry: country, 
        selectedClinic: clinic 
      }),

      clearCountry: () => set({ 
        selectedCountry: null, 
        selectedClinic: null, 
        selectedPatient: null 
      }),

      clearClinic: () => set({ 
        selectedClinic: null, 
        selectedPatient: null 
      }),

      setSelectedPatient: (patient) => set({ selectedPatient: patient }),
      
      notifications: [],
      notify: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          notifications: [...state.notifications, { id, message, type }]
        }));
      },
    }),
    {
      name: 'haefa-progoty-session-v3',
      partialize: (state) => ({ 
        selectedCountry: state.selectedCountry, 
        selectedClinic: state.selectedClinic,
        userProfile: state.userProfile
      }),
    }
  )
);