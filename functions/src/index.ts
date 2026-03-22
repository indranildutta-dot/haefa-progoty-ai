import { 
  onCall, 
  HttpsError 
} from "firebase-functions/v2/https";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as ExcelJS from 'exceljs';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ==========================================
// SUPER ADMIN CONFIGURATION
// These emails bypass all database checks.
// ==========================================
const SUPER_ADMIN_EMAILS = [
  'indranil_dutta@haefa.org', 
  'ruhul_abid@haefa.org'
];

/**
 * Helper to verify if the caller is a Global Admin
 */
const checkIsGlobalAdmin = (auth: any) => {
  if (!auth) return false;
  const email = auth.token.email?.toLowerCase();
  const role = auth.token.role;
  return SUPER_ADMIN_EMAILS.includes(email) || role === 'global_admin';
};

// --- Utility Functions ---

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

const parseClinicalDate = (input: any): Date | null => {
  if (!input) return null;
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
};

const sanitizeData = (data: any) => {
  if (!data || typeof data !== 'object') return {};
  const sanitized: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== undefined && value !== null) {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

// --- Administrative & RBAC Functions ---

export const syncUserPermissions = onCall(
  { region: "us-central1", maxInstances: 10 },
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized: Global Admin required.");
    }
    const { email, role, countryCode, assignedCountries, assignedClinics, isApproved } = request.data;
    if (!email || !role) {
      throw new HttpsError("invalid-argument", "Missing email or role.");
    }
    try {
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({ email });
        } else {
          throw error;
        }
      }
      const uid = userRecord.uid;
      await admin.auth().setCustomUserClaims(uid, { role });
      await db.collection("users").doc(uid).set({
        email, role, countryCode: countryCode || null,
        assignedCountries: assignedCountries || [],
        assignedClinics: assignedClinics || [],
        isApproved: isApproved ?? false,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

export const deleteUser = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }
    const { uid } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "Missing UID.");
    if (request.auth.uid === uid) {
      throw new HttpsError("failed-precondition", "You cannot delete yourself.");
    }
    try {
      await admin.auth().deleteUser(uid);
      await db.collection("users").doc(uid).delete();
      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

export const wipeDemoData = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }
    const collectionsToWipe = ["patients", "encounters", "queues_active"];
    try {
      for (const colName of collectionsToWipe) {
        const snapshot = await db.collection(colName).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

export const initClinics = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }
    const clinicsToCreate = [
      { id: 'BD-01', name: 'Dhaka Clinic', country: 'Bangladesh', code: 'BD', currency: 'BDT' },
      { id: 'BD-02', name: 'Cox’s Bazar Clinic', country: 'Bangladesh', code: 'BD', currency: 'BDT' },
      { id: 'BD-03', name: 'Noakhali Clinic', country: 'Bangladesh', code: 'BD', currency: 'BDT' },
      { id: 'BD-04', name: 'Kurigram Clinic', country: 'Bangladesh', code: 'BD', currency: 'BDT' },
      { id: 'BD-05', name: 'Gazipur Clinic', country: 'Bangladesh', code: 'BD', currency: 'BDT' },
      { id: 'SB-01', name: 'SL Island 1', country: 'Solomon Islands', code: 'SB', currency: 'SBD' },
      { id: 'SB-02', name: 'SL Island 2', country: 'Solomon Islands', code: 'SB', currency: 'SBD' },
      { id: 'NP-01', name: 'Kathmandu 1', country: 'Nepal', code: 'NP', currency: 'NPR' },
      { id: 'NP-02', name: 'Kathmandu 2', country: 'Nepal', code: 'NP', currency: 'NPR' }
    ];

    const commonSettings = {
      max_patients_per_day: 1000,
      timezone: 'UTC',
      status: 'active',
      units: { weight: 'kg', height: 'cm', blood_pressure: 'mmHg', temperature: 'Celsius', blood_glucose: 'mg/dL', heart_rate: 'bpm' },
      queue_structure: [
        { id: 'registration', name: 'Registration', order: 1 },
        { id: 'vitals', name: 'Vitals', order: 2 },
        { id: 'consultation', name: 'Doctor Consultation', order: 3 },
        { id: 'pharmacy', name: 'Pharmacy/Dispensing', order: 4 }
      ],
      supported_roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech'],
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      const batch = db.batch();
      clinicsToCreate.forEach((clinic) => {
        const docRef = db.collection('clinics').doc(clinic.id);
        batch.set(docRef, {
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          country_code: clinic.code,
          country_name: clinic.country,
          local_currency: clinic.currency,
          ...commonSettings
        }, { merge: true });
      });
      await batch.commit();
      return { success: true, count: clinicsToCreate.length };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

// --- Patient & Clinical ---

export const registerPatient = onCall(
  { region: "us-central1" },
  async (request: any) => {
    const data = request.data || {};
    const { patientData, photoBase64, clinicId, countryCode } = data;
    if (!patientData || !clinicId || !countryCode) {
      throw new HttpsError("invalid-argument", "Missing registration data");
    }
    try {
      const patientId = generateId();
      const encounterId = generateId();
      let photoUrl = "";
      if (photoBase64 && photoBase64.includes(",")) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(`patient_photos/${patientId}/photo.jpg`);
        const buffer = Buffer.from(photoBase64.split(",")[1], "base64");
        await file.save(buffer, { contentType: "image/jpeg" });
        const signedUrls = await file.getSignedUrl({ action: "read", expires: "03-01-2500" });
        photoUrl = signedUrls[0];
      }
      
      await db.collection("patients").doc(patientId).set({ ...sanitizeData(patientData), photo_url: photoUrl, created_at: new Date() });
      await db.collection("encounters").doc(encounterId).set({ patient_id: patientId, clinic_id: clinicId, country_code: countryCode, status: 'WAITING_FOR_VITALS', created_at: new Date() });
      
      const fullName = `${patientData.given_name || ''} ${patientData.family_name || ''}`.trim() || 'Unknown';
      await db.collection("queues_active").add({ encounter_id: encounterId, patient_id: patientId, patient_name: fullName, station: 'vitals', status: 'WAITING_FOR_VITALS', clinic_id: clinicId, country_code: countryCode, created_at: new Date(), updated_at: new Date() });
      
      return { patientId, encounterId };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

// --- Pharmacy & Inventory ---

/**
 * DISPENSE MEDICATION: Supports partial dispensing and Scenarios B & C.
 */
export const dispenseMedication = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

    const { clinicId, medications, encounterId, patientId } = request.data;
    if (!clinicId || !medications || !encounterId) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    return await db.runTransaction(async (transaction) => {
      const results: any[] = [];

      for (const med of medications) {
        const medIdLower = med.medication_id.toString().toLowerCase().replace(/\s+/g, '');
        const dosageNormalized = (med.dosage || '').toString().toLowerCase().replace(/\s+/g, '');
        const prescribedQty = Number(med.quantity) || 0;
        const dispensedQtyVal = (typeof med.dispensed_qty !== 'undefined' && med.dispensed_qty !== null && med.dispensed_qty !== '') ? Number(med.dispensed_qty) : prescribedQty;
        const targetQty = isNaN(dispensedQtyVal) ? prescribedQty : dispensedQtyVal;
              
        const inventoryRef = db.collection(`clinics/${clinicId}/inventory`);
        const q = inventoryRef
          .where("med_id_lower", "==", medIdLower)
          .where("dosage_normalized", "==", dosageNormalized)
          .orderBy("expiry_date", "asc");
        
        const snapshot = await transaction.get(q);
        let remainingToDispense = targetQty;
        let actualDispensed = 0;

        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            if (remainingToDispense <= 0) break;
            const batch = doc.data();
            const available = Number(batch.quantity) || 0;
            if (available <= 0) continue; 

            const toTake = Math.min(available, remainingToDispense);
            transaction.update(doc.ref, { quantity: available - toTake });
            
            actualDispensed += toTake;
            remainingToDispense -= toTake;
            
            transaction.set(db.collection("inventory_logs").doc(), {
              clinic_id: clinicId,
              medication_id: med.medication_id,
              type: 'dispense',
              quantity: toTake,
              batch_id: batch.batch_id || "N/A",
              user_id: request.auth.uid,
              encounter_id: encounterId,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }

        const shortfall = prescribedQty - actualDispensed;

        if (shortfall > 0) {
          const procurementRef = db.collection("procurement_requests").doc();
          transaction.set(procurementRef, {
            clinic_id: clinicId,
            patient_id: patientId || "Unknown",
            medication_id: med.medication_id,
            dosage: med.dosage,
            prescribed_qty: prescribedQty,
            dispensed_qty: actualDispensed,
            shortfall_qty: shortfall,
            status: 'PENDING_ORDER',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            encounter_id: encounterId
          });
        }

        results.push({
          medication: med.medication_id,
          prescribed: prescribedQty,
          dispensed: actualDispensed,
          shortfall: shortfall
        });
      }

      const encounterRef = db.collection("encounters").doc(encounterId);
      transaction.update(encounterRef, { 
        status: 'PHARMACY_COMPLETED',
        last_updated: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, summary: results };
    });
  }
);

export const getInventoryTemplate = onCall(
  { region: "us-central1" },
  async (request: any) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventory Template');
    sheet.columns = [
      { header: 'medication_id', key: 'name', width: 25 },
      { header: 'batch_id', key: 'batch', width: 15 },
      { header: 'expiry_date', key: 'expiry', width: 15 },
      { header: 'quantity', key: 'qty', width: 10 },
      { header: 'base_unit', key: 'base', width: 12 },
      { header: 'package_unit', key: 'pkg', width: 12 },
      { header: 'dosage', key: 'dosage', width: 15 }
    ];
    const buffer = await (workbook as any).xlsx.writeBuffer();
    return { fileBase64: Buffer.from(buffer).toString('base64') };
  }
);

export const bulkUpload = onCall(
  { region: "us-central1" },
  async (request: any) => {
    const { clinicId, fileBase64 } = request.data;
    const workbook = new ExcelJS.Workbook();
    await (workbook as any).xlsx.load(Buffer.from(fileBase64, 'base64'));
    const worksheet = workbook.getWorksheet(1);
    const batch = db.batch();
    worksheet?.eachRow((row, rowNumber) => {
      const medId = row.getCell(1).value?.toString().trim() || "";
      const dosage = row.getCell(7).value?.toString().trim() || "N/A";
      if (!medId || medId.toUpperCase().includes('EXAMPLE')) return;
      const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
      batch.set(docRef, { medication_id: medId, med_id_lower: medId.toLowerCase().replace(/\s+/g, ''), dosage, dosage_normalized: dosage.toLowerCase().replace(/\s+/g, ''), expiry_date: Timestamp.fromDate(new Date(row.getCell(3).value as any)), quantity: Number(row.getCell(4).value) || 0, created_at: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    return { success: true };
  }
);

export const stockAlerts = onSchedule("every 24 hours", async (event: ScheduledEvent) => {
  const ninetyDays = new Date(); ninetyDays.setDate(ninetyDays.getDate() + 90);
  const clinics = await db.collection("clinics").get();
  for (const doc of clinics.docs) {
    const expiring = await db.collection(`clinics/${doc.id}/inventory`).where("expiry_date", "<=", Timestamp.fromDate(ninetyDays)).where("quantity", ">", 0).get();
    if (!expiring.empty) console.log(`Alert: ${expiring.size} expiring batches in ${doc.id}`);
  }
});