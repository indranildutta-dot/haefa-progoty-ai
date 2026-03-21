export interface ClinicConfig {
  id: string;
  name: string;
}

export interface CountryConfig {
  id: string;
  name: string;
  currency: string;
  dateFormat: string;
  language: string;
  flag: string;
  clinics: ClinicConfig[];
}

export const countries: CountryConfig[] = [
  {
    id: 'BD',
    name: 'Bangladesh',
    currency: 'BDT',
    dateFormat: 'DD/MM/YYYY',
    language: 'Bengali',
    flag: '🇧🇩',
    clinics: [
      { id: 'BD-01', name: 'Dhaka' },
      { id: 'BD-02', name: 'Cox\'s Bazar' },
      { id: 'BD-03', name: 'Noakhali' },
      { id: 'BD-04', name: 'Kurigram' },
      { id: 'BD-05', name: 'Gazipur' }
    ]
  },
  {
    id: 'NP',
    name: 'Nepal',
    currency: 'NPR',
    dateFormat: 'YYYY-MM-DD',
    language: 'Nepali',
    flag: '🇳🇵',
    clinics: [
      { id: 'NP-01', name: 'Kathmandu General Hospital' },
      { id: 'NP-02', name: 'Pokhara Community Clinic' }
    ]
  },
  {
    id: 'SB',
    name: 'Solomon Islands',
    currency: 'SBD',
    dateFormat: 'DD/MM/YYYY',
    language: 'English',
    flag: '🇸🇧',
    clinics: [
      { id: 'SB-01', name: 'Honiara National Referral Hospital' },
      { id: 'SB-02', name: 'Gizo Area Health Center' }
    ]
  }
];
