import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { getSession } from "../utils/session";

export const dispenseMedication = async (patientId: string, encounterId: string, medications: { medication_id: string, quantity: number }[]) => {
  const { selectedClinic } = getSession();
  if (!selectedClinic) throw new Error("Clinic not selected");

  const dispense = httpsCallable(functions, 'dispenseMedication');
  return await dispense({
    clinicId: selectedClinic.id,
    patientId,
    encounterId,
    medications
  });
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
