import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { getSession } from "../utils/session";

/**
 * Dispense Medication
 * Sends the dispensed quantities and the optional IOU return date to the backend.
 */
export const dispenseMedication = async (
  clinicId: string, 
  patientId: string, 
  encounterId: string, 
  medications: { 
    medication_id: string, 
    dosage: string, 
    quantity: number, 
    dispensed_qty: number 
  }[], 
  returnDate?: string
) => {
  const dispense = httpsCallable(functions, 'dispenseMedication');
  
  const result = await dispense({
    clinicId,
    patientId,
    encounterId,
    medications,
    returnDate // This must match the field name in your index.ts
  });
  
  return result.data;
};

/**
 * Bulk Inventory Upload
 * Converts the Excel base64 string into a format the Cloud Function can process.
 */
export const bulkUpload = async (fileBase64: string) => {
  const { selectedClinic } = getSession();
  
  if (!selectedClinic) {
    throw new Error("No clinic selected. Please select a clinic before uploading inventory.");
  }

  const upload = httpsCallable(functions, 'bulkUpload');
  
  return await upload({
    clinicId: selectedClinic.id,
    fileBase64
  });
};