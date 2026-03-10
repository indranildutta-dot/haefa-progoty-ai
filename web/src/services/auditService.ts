import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { AuditLog, UserRole } from "../types";
import { useAppStore } from "../store/useAppStore";

const AUDIT_LOGS_COLLECTION = "audit_logs";

// Simple device ID generation
const getDeviceId = () => {
  let deviceId = localStorage.getItem('haefa_device_id');
  if (!deviceId) {
    deviceId = 'dev-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('haefa_device_id', deviceId);
  }
  return deviceId;
};

export const logAction = async (params: {
  action: AuditLog['action'];
  patient_id?: string;
  encounter_id?: string;
}) => {
  try {
    const { selectedCountry, selectedClinic, userProfile } = useAppStore.getState();
    const user = auth.currentUser;
    
    if (!user || !selectedCountry || !selectedClinic) {
      console.warn("Audit log skipped: missing user or session context");
      return;
    }

    const role: UserRole | 'unknown' = userProfile?.role || 'unknown'; 

    const logEntry: Omit<AuditLog, 'id'> = {
      user_id: user.uid,
      role: role,
      action: params.action,
      patient_id: params.patient_id,
      encounter_id: params.encounter_id,
      timestamp: serverTimestamp() as any,
      device_id: getDeviceId(),
      country_code: selectedCountry.id,
      clinic_id: selectedClinic.id,
      created_at: serverTimestamp() as any,
      updated_at: serverTimestamp() as any
    };

    await addDoc(collection(db, AUDIT_LOGS_COLLECTION), logEntry);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};
