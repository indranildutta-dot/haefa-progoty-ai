import { collection, getDocs, query, where, deleteDoc, doc, or } from "firebase/firestore";
import { db } from "../firebase";

export const clearBangladeshData = async () => {
  const collectionsToClear = [
    "patients",
    "triage_assessments",
    "queues_active",
    "queues_archive",
    "encounters",
    "encounters_archive",
    "vitals",
    "diagnoses",
    "prescriptions",
    "dispensations",
    "audit_logs",
    "patient_allergies",
    "clinic_metrics",
    "country_metrics"
  ];

  const countryIds = ['BD', 'bangladesh', 'Bangladesh'];

  for (const colName of collectionsToClear) {
    try {
      const docIds = new Set<string>();

      try {
        const q1 = query(collection(db, colName), where("country_id", "in", countryIds));
        const snapshot1 = await getDocs(q1);
        snapshot1.docs.forEach(d => docIds.add(d.id));
      } catch (e) {
        // Ignore index errors if country_id doesn't exist
      }
      
      try {
        const q2 = query(collection(db, colName), where("country_code", "in", countryIds));
        const snapshot2 = await getDocs(q2);
        snapshot2.docs.forEach(d => docIds.add(d.id));
      } catch (e) {
        // Ignore index errors if country_code doesn't exist
      }
      
      if (docIds.size > 0) {
        const deletePromises = Array.from(docIds).map(id => deleteDoc(doc(db, colName, id)));
        await Promise.all(deletePromises);
        console.log(`Cleared ${docIds.size} documents from ${colName}`);
      }
    } catch (error) {
      console.error(`Error clearing ${colName}:`, error);
    }
  }
};
