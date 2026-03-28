import { 
  onCall, 
  HttpsError 
} from "firebase-functions/v2/https";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ==========================================
// CONFIGURATION & GLOBAL SETTINGS
// ==========================================
const SUPER_ADMIN_EMAILS = [
  'indranil_dutta@haefa.org', 
  'ruhul_abid@haefa.org'
];

const REQUISITION_THRESHOLD = 500; // Low stock alert level for Dhaka

/**
 * Helper to verify if the caller is a Global Admin
 */
const checkIsGlobalAdmin = (auth: any) => {
  if (!auth) return false;
  const email = auth.token.email?.toLowerCase();
  const role = auth.token.role;
  return SUPER_ADMIN_EMAILS.includes(email) || role === 'global_admin';
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
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

// ==========================================
// ADMINISTRATIVE & RBAC FUNCTIONS
// ==========================================

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

export const wipeTestData = onCall(
  { region: "us-central1", timeoutSeconds: 540, memory: "1GiB" }, 
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }

    const collections = ["patients", "encounters", "queues_active", "requisitions", "procurement_requests"];
    let totalDeleted = 0;

    for (const colName of collections) {
      let hasMore = true;
      while (hasMore) {
        const querySnapshot = await db.collection(colName).limit(500).get();

        if (querySnapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        querySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += querySnapshot.size;
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return { success: true, deletedCount: totalDeleted };
  }
);

export const wipeDemoData = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!checkIsGlobalAdmin(request.auth)) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }
    const collectionsToWipe = ["patients", "encounters", "queues_active", "requisitions"];
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
      { id: 'SB-01', name: 'SL Island 1', country: 'Solomon Islands', code: 'SB', currency: 'SBD' },
      { id: 'NP-01', name: 'Kathmandu 1', country: 'Nepal', code: 'NP', currency: 'NPR' }
    ];

    const commonSettings = {
      max_patients_per_day: 1000,
      status: 'active',
      queue_structure: [
        { id: 'registration', name: 'Registration', order: 1 },
        { id: 'vitals', name: 'Vitals', order: 2 },
        { id: 'consultation', name: 'Doctor Consultation', order: 3 },
        { id: 'pharmacy', name: 'Pharmacy/Dispensing', order: 4 }
      ],
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      const batch = db.batch();
      clinicsToCreate.forEach((clinic) => {
        const docRef = db.collection('clinics').doc(clinic.id);
        batch.set(docRef, { ...clinic, ...commonSettings }, { merge: true });
      });
      await batch.commit();
      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

// ==========================================
// PATIENT & CLINICAL FUNCTIONS
// ==========================================

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
      
      const batch = db.batch();
      batch.set(db.collection("patients").doc(patientId), { 
        ...sanitizeData(patientData), 
        photo_url: photoUrl, 
        created_at: new Date() 
      });
      
      batch.set(db.collection("encounters").doc(encounterId), { 
        patient_id: patientId, clinic_id: clinicId, country_code: countryCode, 
        status: 'WAITING_FOR_VITALS', created_at: new Date() 
      });
      
      const fullName = `${patientData.given_name || ''} ${patientData.family_name || ''}`.trim();
      batch.set(db.collection("queues_active").doc(), { 
        encounter_id: encounterId, patient_id: patientId, patient_name: fullName, 
        station: 'vitals', status: 'WAITING_FOR_VITALS', clinic_id: clinicId, 
        country_code: countryCode, created_at: new Date(), updated_at: new Date() 
      });
      
      await batch.commit();
      return { patientId, encounterId };
    } catch (error: any) {
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * Handles Doctor Consultation and Automatic Requisition triggers
 */
export const saveConsultation = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const { encounterId, patientId, clinicId, prescriptions, diagnosis, notes } = request.data;
    
    const qSnap = await db.collection("queues_active").where("encounter_id", "==", encounterId).get();

    return await db.runTransaction(async (transaction) => {
      const encounterRef = db.collection("encounters").doc(encounterId);
      transaction.update(encounterRef, {
        status: 'WAITING_FOR_PHARMACY',
        diagnosis, notes,
        last_updated: admin.firestore.FieldValue.serverTimestamp()
      });

      const presRef = db.collection("prescriptions").doc();
      transaction.set(presRef, {
        encounter_id: encounterId, patient_id: patientId, clinic_id: clinicId,
        prescriptions, created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      for (const med of prescriptions) {
        if (med.isRequisition) {
          const reqRef = db.collection("requisitions").doc();
          transaction.set(reqRef, {
            clinic_id: clinicId, medication_name: med.medicationName,
            dosage: `${med.dosageValue}${med.dosageUnit}`, requested_qty: med.quantity,
            type: 'DOCTOR_ORDER_NON_STOCK', status: 'PENDING',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      qSnap.forEach(doc => transaction.update(doc.ref, { 
        station: 'pharmacy', status: 'WAITING_FOR_PHARMACY', 
        updated_at: admin.firestore.FieldValue.serverTimestamp() 
      }));

      return { success: true };
    });
  }
);

// ==========================================
// PHARMACY & INVENTORY FUNCTIONS
// ==========================================

export const dispenseMedication = onCall(
  { region: "us-central1" },
  async (request: any) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const { clinicId, medications, encounterId, patientId } = request.data;

    return await db.runTransaction(async (transaction) => {
      const results: any[] = [];

      for (const med of medications) {
        const { medication_name, mode, qty, substitution, return_on } = med;
        const targetMedName = (mode === 'SUBSTITUTE' && substitution) ? substitution : medication_name;
        const medIdLower = targetMedName.toLowerCase().replace(/\s+/g, '');
        
        let actualDeducted = 0;

        if (mode !== 'OUT_OF_STOCK') {
          const inventoryRef = db.collection(`clinics/${clinicId}/inventory`);
          const q = inventoryRef.where("med_id_lower", "==", medIdLower);
          const snapshot = await transaction.get(q);

          let remaining = Number(qty);
          for (const doc of snapshot.docs) {
            if (remaining <= 0) break;
            const available = Number(doc.data().quantity) || 0;
            const toTake = Math.min(available, remaining);
            const newQty = available - toTake;
            
            transaction.update(doc.ref, { quantity: newQty });
            actualDeducted += toTake;
            remaining -= toTake;

            if (newQty < REQUISITION_THRESHOLD) {
              transaction.set(db.collection("requisitions").doc(), {
                clinic_id: clinicId, medication_name: targetMedName,
                current_stock: newQty, type: 'LOW_STOCK_ALERT', status: 'PENDING',
                created_at: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }

        if (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') {
          transaction.set(db.collection("requisitions").doc(), {
            clinic_id: clinicId, patient_id: patientId, medication_name: medication_name,
            type: 'PATIENT_IOU_SHORTFALL', status: 'WAITING_FOR_STOCK',
            return_date: return_on || null, encounter_id: encounterId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        results.push({ medication: medication_name, dispensed: actualDeducted });
      }

      transaction.update(db.collection("encounters").doc(encounterId), { 
        status: 'COMPLETED', last_updated: admin.firestore.FieldValue.serverTimestamp() 
      });
      return { success: true, summary: results };
    });
  }
);

/**
 * BULK UPLOAD: Uses Lazy Loading to fix deployment timeouts
 */
export const bulkUpload = onCall(
  { region: "us-central1" },
  async (request: any) => {
    const { clinicId, fileBase64 } = request.data;
    // CRITICAL: Loading inside function body to bypass CLI timeout
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // Type-cast to any to fix Buffer error from image_1e363e.png
    await workbook.xlsx.load(Buffer.from(fileBase64, 'base64') as any);
    const worksheet = workbook.getWorksheet(1);
    const batch = db.batch();
    
    worksheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const medId = row.getCell(1).value?.toString().trim() || "";
      const qty = Number(row.getCell(4).value) || 0;
      const dosage = row.getCell(7).value?.toString().trim() || "N/A";
      
      if (!medId || medId.toUpperCase().includes('EXAMPLE')) return;
      
      const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
      batch.set(docRef, { 
        medication_id: medId, 
        med_id_lower: medId.toLowerCase().replace(/\s+/g, ''), 
        dosage, quantity: qty, 
        created_at: admin.firestore.FieldValue.serverTimestamp() 
      });
    });
    await batch.commit();
    return { success: true };
  }
);

export const getInventoryTemplate = onCall(
  { region: "us-central1" },
  async (request: any) => {
    const ExcelJS = await import('exceljs');
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
    const buffer = await workbook.xlsx.writeBuffer();
    // Type-cast to any to fix Buffer error from image_1e363e.png
    return { fileBase64: (buffer as any).toString('base64') };
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