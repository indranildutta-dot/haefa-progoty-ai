import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { getSession } from "../utils/session";

export const dispenseMedication = async (clinicId: string, patientId: string, encounterId: string, medications: { medication_id: string, dosage: string, quantity: number, dispensed_qty: number }[], returnDate?: string) => {
  const dispense = httpsCallable(functions, 'dispenseMedication');
  const result = await dispense({
    clinicId,
    patientId,
    encounterId,
    medications,
    returnDate
  });
  return result.data;
};

export const bulkUpload = async (fileBase64: string) => {
  const { selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  const upload = httpsCallable(functions, 'bulkUpload');
  return await upload({
    clinicId: selectedClinic.id,
    fileBase64
  });
};
