import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Medication, DrugInteraction, PatientAllergy, Prescription, SafetyAlert } from "../types";

const MEDICATIONS_COLLECTION = "medications";
const INTERACTIONS_COLLECTION = "drug_interactions";
const ALLERGIES_COLLECTION = "patient_allergies";

// Helper to extract numeric dose from a string (e.g., "500 mg" -> 500)
const extractNumericDose = (dosageStr: string): number => {
  const match = dosageStr.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

// Helper to estimate daily frequency from string (e.g., "3 times a day" -> 3)
const estimateDailyFrequency = (freqStr: string): number => {
  const lower = freqStr.toLowerCase();
  if (lower.includes('once') || lower.includes('1')) return 1;
  if (lower.includes('twice') || lower.includes('2')) return 2;
  if (lower.includes('thrice') || lower.includes('3')) return 3;
  if (lower.includes('4')) return 4;
  return 1; // default fallback
};

export const checkPrescriptionSafety = async (
  patientId: string,
  prescriptions: Prescription[]
): Promise<SafetyAlert[]> => {
  const alerts: SafetyAlert[] = [];
  if (!prescriptions || prescriptions.length === 0) return alerts;

  const medNames = prescriptions.map(p => p.medicationName.toLowerCase().trim());

  try {
    // 1. Check Allergies
    const allergiesRef = collection(db, ALLERGIES_COLLECTION);
    const allergiesQuery = query(allergiesRef, where("patient_id", "==", patientId));
    const allergiesSnap = await getDocs(allergiesQuery);
    const allergies = allergiesSnap.docs.map(doc => doc.data() as PatientAllergy);

    for (const p of prescriptions) {
      const pName = p.medicationName.toLowerCase().trim();
      const allergy = allergies.find(a => a.medicationName.toLowerCase().trim() === pName);
      if (allergy) {
        alerts.push({
          type: 'allergy',
          severity: allergy.severity,
          description: `Patient has a ${allergy.severity} allergy to ${p.medicationName}. Notes: ${allergy.notes || 'None'}`,
          medicationNames: [p.medicationName]
        });
      }
    }

    // 2. Check Drug Interactions
    // Fetch all interactions where medication1Name or medication2Name is in our list
    // Since we can't easily do an OR query with 'in' for both fields in Firestore without composite indexes,
    // we'll fetch all interactions for the prescribed meds.
    const interactionsRef = collection(db, INTERACTIONS_COLLECTION);
    for (const pName of medNames) {
      const q1 = query(interactionsRef, where("medication1Name", "==", pName));
      const snap1 = await getDocs(q1);
      
      snap1.forEach(doc => {
        const interaction = doc.data() as DrugInteraction;
        if (medNames.includes(interaction.medication2Name.toLowerCase().trim())) {
          // Avoid duplicates
          const exists = alerts.find(a => 
            a.type === 'interaction' && 
            a.medicationNames.includes(interaction.medication1Name) && 
            a.medicationNames.includes(interaction.medication2Name)
          );
          if (!exists) {
            alerts.push({
              type: 'interaction',
              severity: interaction.severity,
              description: `Interaction between ${interaction.medication1Name} and ${interaction.medication2Name}: ${interaction.description}`,
              medicationNames: [interaction.medication1Name, interaction.medication2Name]
            });
          }
        }
      });

      const q2 = query(interactionsRef, where("medication2Name", "==", pName));
      const snap2 = await getDocs(q2);
      
      snap2.forEach(doc => {
        const interaction = doc.data() as DrugInteraction;
        if (medNames.includes(interaction.medication1Name.toLowerCase().trim())) {
          // Avoid duplicates
          const exists = alerts.find(a => 
            a.type === 'interaction' && 
            a.medicationNames.includes(interaction.medication1Name) && 
            a.medicationNames.includes(interaction.medication2Name)
          );
          if (!exists) {
            alerts.push({
              type: 'interaction',
              severity: interaction.severity,
              description: `Interaction between ${interaction.medication1Name} and ${interaction.medication2Name}: ${interaction.description}`,
              medicationNames: [interaction.medication1Name, interaction.medication2Name]
            });
          }
        }
      });
    }

    // 3. Check Maximum Safe Dosage
    const medsRef = collection(db, MEDICATIONS_COLLECTION);
    for (const p of prescriptions) {
      const pName = p.medicationName.toLowerCase().trim();
      const q = query(medsRef, where("name", "==", pName));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const medData = snap.docs[0].data() as Medication;
        if (medData.maxDailyDose) {
          const dose = extractNumericDose(p.dosage);
          const freq = estimateDailyFrequency(p.frequency);
          const dailyDose = dose * freq;
          
          if (dailyDose > medData.maxDailyDose) {
            alerts.push({
              type: 'dosage',
              severity: 'high',
              description: `Prescribed daily dose (${dailyDose} ${medData.unit || 'mg'}) exceeds maximum safe daily dose (${medData.maxDailyDose} ${medData.unit || 'mg'}) for ${p.medicationName}.`,
              medicationNames: [p.medicationName]
            });
          }
        }
      }
    }

  } catch (error) {
    console.error("Error checking medication safety:", error);
    // In a real app, we might want to alert the user that safety checks failed,
    // but we'll just return the alerts we have so far or an error alert.
    alerts.push({
      type: 'interaction',
      severity: 'moderate',
      description: 'Failed to complete all safety checks due to a network error.',
      medicationNames: []
    });
  }

  return alerts;
};
