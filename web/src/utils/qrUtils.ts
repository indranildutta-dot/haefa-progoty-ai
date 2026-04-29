import { Patient } from '../types';

export const generateFatQrData = (patient: Patient, extra?: { bloodGroup?: string, allergies?: string[] }): string => {
  let age = 0;
  if (patient.age_years) {
    age = patient.age_years;
  } else if (patient.date_of_birth) {
    age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
  } else if (patient.estimated_birth_year) {
    age = new Date().getFullYear() - patient.estimated_birth_year;
  }

  const payload: any = {
    i: patient.id,
    n: `${patient.family_name}, ${patient.given_name.charAt(0)}.`,
    a: age,
    g: patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O',
  };
  
  if (extra?.bloodGroup) {
    payload.bg = extra.bloodGroup;
  }
  
  if (extra?.allergies && extra.allergies.length > 0) {
    payload.al = extra.allergies.join(',').substring(0, 50); // limit length to keep QR clean
  }
  
  return JSON.stringify(payload);
};

export const parseFatQrData = (qrData: string): Partial<Patient> & { blood_group?: string; allergies?: string[] } | null => {
  try {
    if (qrData.startsWith('{')) {
      const parsed = JSON.parse(qrData);
      
      if (parsed.i) {
        return {
          id: parsed.i,
          family_name: parsed.n ? parsed.n.split(',')[0].trim() : '',
          given_name: parsed.n ? parsed.n.split(',')[1]?.trim()?.replace('.', '') || '' : '',
          age_years: parsed.a,
          gender: parsed.g === 'M' ? 'male' : parsed.g === 'F' ? 'female' : 'other',
          blood_group: parsed.bg,
          allergies: parsed.al ? parsed.al.split(',') : undefined
        };
      }
    } else if (qrData.startsWith('HAEFA-')) {
       // Extract actual patient ID from older tokens? Wait, earlier we used `qrToken` which wasn't the ID. 
       // The `badge_tokens` resolved the `qrToken` to `patient_id`. We may still need to parse it if we can.
       // We can return the token here.
       return { id: qrData }; 
    } else {
        // Assume it's just an ID
        return { id: qrData };
    }
  } catch (e) {
    console.error("Failed to parse fat QR:", e);
  }
  return null;
}
