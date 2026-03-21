import { doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firestoreError";

const METRICS_COLLECTION = "clinic_metrics";

export const updateQueueMetric = async (clinicId: string, updates: {
  patients_registered_today?: number;
  waiting_for_vitals?: number;
  ready_for_doctor?: number;
  in_consultation?: number;
  waiting_for_pharmacy?: number;
  completed_today?: number;
  avg_wait_time_minutes?: number;
}) => {
  const metricsRef = doc(db, METRICS_COLLECTION, clinicId);
  const metricsSnap = await getDoc(metricsRef);

  const updateData: any = {
    last_updated: serverTimestamp()
  };

  Object.entries(updates).forEach(([key, value]) => {
    updateData[key] = increment(value);
  });

  if (!metricsSnap.exists()) {
    try {
      await setDoc(metricsRef, {
        clinic_id: clinicId,
        patients_registered_today: 0,
        waiting_for_vitals: 0,
        ready_for_doctor: 0,
        in_consultation: 0,
        waiting_for_pharmacy: 0,
        completed_today: 0,
        avg_wait_time_minutes: 0,
        ...Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, value])),
        last_updated: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, METRICS_COLLECTION);
    }
  } else {
    try {
      await updateDoc(metricsRef, updateData);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, METRICS_COLLECTION);
    }
  }
};
