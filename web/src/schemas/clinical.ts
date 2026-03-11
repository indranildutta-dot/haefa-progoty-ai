import { z } from 'zod';
import { countries } from '../config/countries';

export const getPatientSchema = (countryId?: string) => {
  const country = countries.find(c => c.id === countryId);
  const dateFormat = country?.dateFormat || 'YYYY-MM-DD';
  
  const dateRegex = dateFormat === 'DD/MM/YYYY' 
    ? /^\d{2}\/\d{2}\/\d{4}$/ 
    : /^\d{4}-\d{2}-\d{2}$/;
    
  return z.object({
    first_name: z.string().min(2, "First name is too short"),
    last_name: z.string().min(2, "Last name is too short"),
    gender: z.enum(['male', 'female', 'other']),
    date_of_birth: z.string().regex(dateRegex, `Invalid date format (${dateFormat})`),
    phone: z.string().optional(),
    village: z.string().optional(),
    country_id: z.string().optional(),
  });
};

export const VitalsSchema = z.object({
  systolic: z.number().min(50).max(250),
  diastolic: z.number().min(30).max(150),
  heartRate: z.number().min(30).max(220),
  temperature: z.number().min(30).max(45),
  weight: z.number().min(0.5).max(500),
  height: z.number().min(30).max(250),
  oxygenSaturation: z.number().min(50).max(100),
  bmi: z.number().optional(),
});

export type VitalsInput = z.infer<typeof VitalsSchema>;
