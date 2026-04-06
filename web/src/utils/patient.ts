import { Patient } from '../types';

export const calculateAgeYears = (p: Patient | undefined): number => {
  if (!p) return 0;
  
  let years: number | undefined;

  // 1. Try explicit age fields
  if (p.age_years !== null && p.age_years !== undefined) {
    // If age_years looks like a birth year, calculate age
    if (p.age_years > 1900) {
      years = new Date().getFullYear() - p.age_years;
    } else {
      years = p.age_years;
    }
  } 
  // 2. Fallback to DOB
  else if (p.date_of_birth) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (regex.test(p.date_of_birth)) {
      const [_, day, month, year] = p.date_of_birth.match(regex)!;
      const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      const today = new Date();
      
      years = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        years--;
      }
    }
  }
  // 3. Fallback to estimated birth year
  else if (p.estimated_birth_year) {
    years = new Date().getFullYear() - p.estimated_birth_year;
  }

  return years ?? 0;
};

/**
 * Calculates the age display string based on rules:
 * - If age >= 1 year: "[Years]Y"
 * - If age < 1 year: "[Months]M"
 * - If no data: ""
 */
export const calculateAgeDisplay = (p: Patient | undefined): string => {
  if (!p) return '';
  
  let years: number | undefined;
  let months: number | undefined;

  // 1. Try explicit age fields
  if (p.age_years !== null && p.age_years !== undefined) {
    // If age_years looks like a birth year, calculate age
    if (p.age_years > 1900) {
      years = new Date().getFullYear() - p.age_years;
    } else {
      years = p.age_years;
    }
    months = p.age_months;
  } 
  // 2. Fallback to DOB
  else if (p.date_of_birth) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (regex.test(p.date_of_birth)) {
      const [_, day, month, year] = p.date_of_birth.match(regex)!;
      const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      const today = new Date();
      
      years = today.getFullYear() - birthDate.getFullYear();
      months = today.getMonth() - birthDate.getMonth();
      
      if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
      }
      
      if (today.getDate() < birthDate.getDate()) {
        months--;
      }
    }
  }
  // 3. Fallback to estimated birth year
  else if (p.estimated_birth_year) {
    years = new Date().getFullYear() - p.estimated_birth_year;
  }

  // Final formatting
  if (years === undefined || years === null) return '';

  if (years >= 1) {
    return `${years}Y`;
  } else if (months !== undefined && months !== null && months > 0) {
    return `${months}M`;
  } else if (years === 0) {
    return months !== undefined && months !== null ? `${months}M` : '0Y';
  }

  return '';
};
