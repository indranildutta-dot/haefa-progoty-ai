import { z } from 'zod';
import { countries } from '../config/countries';

export const getPatientSchema = (countryId?: string) => {
  return z.object({
    given_name: z.string().min(2, "Given name is too short"),
    middle_name: z.string().optional(),
    family_name: z.string().min(2, "Family name is too short"),
    gender: z.enum(['male', 'female', 'other']),
    date_of_birth: z.string().optional(),
    estimated_birth_year: z.number().optional(),
    is_minor: z.boolean().optional(),
    parent_name: z.string().optional(),
    parent_id: z.string().optional(),
    age_years: z.number().optional(),
    age_months: z.number().optional(),
    age_days: z.number().optional(),
    phone: z.string().optional(),
    marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'separated']).optional(),
    national_id: z.string().optional(),
    rohingya_number: z.string().optional(),
    bhutanese_refugee_number: z.string().optional(),
    address_type: z.enum(['home', 'refugee camp']).optional(),
    address_line: z.string().optional(),
    village: z.string().optional(),
    thana: z.string().optional(),
    upazila: z.string().optional(),
    union: z.string().optional(),
    post_code: z.string().optional(),
    district: z.string().optional(),
    country: z.string().optional(),
    permanent_address_same_as_present: z.boolean().optional(),
    perm_address_line: z.string().optional(),
    perm_village: z.string().optional(),
    perm_district: z.string().optional(),
    perm_upazila: z.string().optional(),
    perm_union: z.string().optional(),
    perm_post_code: z.string().optional(),
    perm_country: z.string().optional(),
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
