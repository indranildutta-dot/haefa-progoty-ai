import { z } from 'zod';

export const PatientSchema = z.object({
  first_name: z.string().min(2, "First name is too short"),
  last_name: z.string().min(2, "Last name is too short"),
  gender: z.enum(['male', 'female', 'other']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  phone: z.string().min(5, "Invalid phone number"),
  village: z.string().min(2, "Village name is too short"),
  country_id: z.string().optional(),
});

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

export type PatientInput = z.infer<typeof PatientSchema>;
export type VitalsInput = z.infer<typeof VitalsSchema>;
