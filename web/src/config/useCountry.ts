import { countries, CountryConfig } from './countries';

export const getCountryConfig = (countryId: string): CountryConfig | undefined => {
  return countries.find(c => c.id === countryId);
};
