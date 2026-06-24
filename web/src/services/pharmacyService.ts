import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { getSession } from "../utils/session";

/**
 * Interface for the detailed dispensing payload.
 * This ensures the backend knows exactly what happened with every pill.
 */
interface DispensePayload {
  medication_id: string;      // The Firestore document ID to subtract from
  medication_name: string;    // Display name for logging
  mode: 'FULL' | 'PARTIAL' | 'OUT_OF_STOCK' | 'SUBSTITUTE';
  qty: number;                // The amount being physically handed over
  substitution?: string | null; // The ID of the generic/alt medicine used
  reason?: string | null;       // Why a substitution or partial was done
  return_on?: string | null;    // IOU date for the patient to get the rest
  is_low_stock?: boolean;       // Trigger for the Requisition system (if < 500)
}

/**
 * Dispense Medication
 * * CRITICAL LOGIC: 
 * This service calls a Cloud Function. The actual subtraction of inventory 
 * happens inside that function using a "Transaction" to ensure that if two 
 * pharmacists dispense the same medicine, the counts stay accurate.
 */
export const dispenseMedication = async (
  clinicId: string, 
  patientId: string, 
  encounterId: string, 
  medications: DispensePayload[]
) => {
  const dispense = httpsCallable(functions, 'dispenseMedication');
  
  // The backend 'dispenseMedication' function handles:
  // 1. Subtracting the 'qty' from clinics/{clinicId}/inventory/{medication_id}
  // 2. Creating a 'dispensing_log' entry for reporting
  // 3. Creating a 'requisition' entry if 'is_low_stock' is true
  const result = await dispense({
    clinicId,
    patientId,
    encounterId,
    medications
  });
  
  return result.data;
};

/**
 * Bulk Inventory Upload
 * * Standardizes the upload process for the Dhaka and other clinics.
 */
export const bulkUpload = async (fileBase64: string, userName?: string, clinicId?: string) => {
  const { selectedClinic } = getSession();
  const targetClinicId = clinicId || selectedClinic?.id;
  
  if (!targetClinicId) {
    throw new Error("No clinic selected. Inventory must be tied to a specific clinic location.");
  }

  let useFallback = false;
  try {
    const response = await fetch("/api/pharmacy/bulk-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clinicId: targetClinicId,
        fileBase64,
        userName: userName || "Pharmacist"
      })
    });

    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    
    // If the response is successful (e.g. 200) but returns HTML, Firebase Hosting rewrote the /api route to index.html.
    // In this case, we MUST trigger the Firebase Cloud Function fallback.
    if (response.ok && contentType && contentType.includes("text/html")) {
      console.warn("API route returned HTML (Firebase Hosting rewrite). Falling back to Cloud Function.");
      useFallback = true;
    } else {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to process bulk upload via Express server.");
    }
  } catch (err) {
    if (!useFallback) {
      console.warn("Express API failed, falling back to Cloud Function:", err);
      useFallback = true;
    }
  }

  if (useFallback) {
    const uploadCallable = httpsCallable(functions, 'bulkUpload');
    const result = await uploadCallable({
      clinicId: targetClinicId,
      fileBase64,
      userName: userName || "Pharmacist"
    });
    return result.data;
  }
};
