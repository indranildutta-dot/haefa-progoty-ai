import { UserProfile } from '../types';

export const MASTER_ADMINS = [
  'indranil_dutta@haefa.org',
  'ruhul_abid@haefa.org'
];

/**
 * Checks if a user profile is a Global Admin or matches a hardcoded Master Admin email.
 */
export const isGlobalAdmin = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  if (profile.role === 'global_admin') return true;
  const emailLower = profile.email?.toLowerCase();
  return MASTER_ADMINS.includes(emailLower);
};

/**
 * Checks if a Country Admin is assigned to the selected country.
 */
export const isCountryAdminFor = (profile: UserProfile | null, countryId: string): boolean => {
  if (!profile) return false;
  if (profile.role === 'country_admin') {
    return Array.isArray(profile.assignedCountries) && profile.assignedCountries.includes(countryId);
  }
  return false;
};

/**
 * Core validation helper to check if a user is approved and has access to a particular country/clinic.
 */
export const isUserApprovedAndClinicScoped = (
  profile: UserProfile | null, 
  countryId: string | undefined, 
  clinicId: string | undefined
): boolean => {
  if (!profile) return false;
  if (isGlobalAdmin(profile)) return true;
  if (!profile.isApproved) return false;

  // Country admin must be assigned to this country
  if (profile.role === 'country_admin') {
    return !!countryId && Array.isArray(profile.assignedCountries) && profile.assignedCountries.includes(countryId);
  }

  // Clinic-scoped roles must have:
  // Clinic ID matches their assigned clinics list
  if (clinicId && Array.isArray(profile.assignedClinics) && !profile.assignedClinics.includes(clinicId)) {
    return false;
  }

  return true;
};

/**
 * Centralized RBAC Station Access Helper.
 * Checks whether the current user profile is permitted to access/write to a specific clinical station.
 */
export const canAccessStation = (
  profile: UserProfile | null,
  station: 'registration' | 'vitals' | 'doctor' | 'pharmacy',
  countryId?: string,
  clinicId?: string
): boolean => {
  if (!profile) return false;

  // 1. Global Admin has full override to everything
  if (isGlobalAdmin(profile)) return true;

  // 2. User must be approved
  if (!profile.isApproved) return false;

  // 3. Country Admin has access to everything in the assigned country
  if (profile.role === 'country_admin') {
    if (countryId && Array.isArray(profile.assignedCountries) && profile.assignedCountries.includes(countryId)) {
      return true;
    }
    return false;
  }

  // 4. Clinic-scoped roles must follow clinic assignment checklist
  if (clinicId && Array.isArray(profile.assignedClinics) && !profile.assignedClinics.includes(clinicId)) {
    return false;
  }

  const role = profile.role;

  // 5. Check role-to-station write permissions
  switch (station) {
    case 'registration':
      // Clinical assistant, Nurse Practitioner, Doctor can write in registration
      // (Also support legacy "nurse" and "registration" roles for backward safety)
      return (
        role === 'clinical_assistant' ||
        role === 'nurse_practitioner' ||
        role === 'doctor' ||
        role === 'registration' ||
        role === 'nurse'
      );

    case 'vitals':
      // Clinical assistant, Nurse Practitioner, Doctor can write in vitals categories (Body Measures, Vital Signs, Labs & Risk)
      // (Also support legacy "nurse" for backward safety)
      return (
        role === 'clinical_assistant' ||
        role === 'nurse_practitioner' ||
        role === 'doctor' ||
        role === 'nurse'
      );

    case 'doctor':
      // Only Doctor and Nurse Practitioner can write/access doctor assessment
      return role === 'doctor' || role === 'nurse_practitioner';

    case 'pharmacy':
      // Pharmacist, Doctor, Nurse Practitioner can write/access pharmacy station
      return (
        role === 'pharmacist' ||
        role === 'pharmacy' ||
        role === 'doctor' ||
        role === 'nurse_practitioner'
      );

    default:
      return false;
  }
};
