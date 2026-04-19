import * as admin from 'firebase-admin';
if (!admin.apps.length) {
  admin.initializeApp();
}

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";

// Import lazy loaders and helpers from utils
import { 
  getAdmin, 
  getDb, 
  getCrypto, 
  checkIsGlobalAdmin, 
  sanitizeData, 
  REQUISITION_THRESHOLD 
} from "./utils";

// Set global options to reduce boilerplate and potentially speed up discovery
setGlobalOptions({ 
  region: "us-central1",
  maxInstances: 10
});

// ==========================================
// ICD-11 INTEGRATION FUNCTIONS
// ==========================================

let cachedToken: { token: string; expiry: number } | null = null;

export const getIcdToken = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const now = Date.now();
    // Reuse token if it's still valid for at least 2 minutes
    if (cachedToken && cachedToken.expiry > now + 120000) {
      console.log("Returning cached ICD token.");
      return cachedToken.token;
    }

    const clientId = process.env.WHO_CLIENT_ID;
    const clientSecret = process.env.WHO_CLIENT_SECRET;

    console.log("Fetching new ICD token from WHO API...");
    if (!clientId || !clientSecret) {
      console.error("WHO_CLIENT_ID or WHO_CLIENT_SECRET missing in environment.");
      throw new HttpsError("failed-precondition", "WHO ICD-11 credentials are not configured in the environment.");
    }

    const response = await fetch("https://icdaccessmanagement.who.int/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "icdapi_access",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WHO Token Error Response:", errorText);
      throw new Error(`WHO API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    if (!data.access_token) {
      console.error("WHO API returned success but no access_token:", data);
      throw new Error("WHO API returned no access_token.");
    }

    console.log("Successfully retrieved ICD token. Length:", data.access_token.length);
    
    cachedToken = {
      token: data.access_token,
      expiry: now + (data.expires_in * 1000),
    };

    return data.access_token;
  } catch (error: any) {
    logger.error('ICD_TOKEN_FAILURE', { 
      error: error.message, 
      stack: error.stack,
      response: error.response?.data 
    });
    console.error("getIcdToken Exception:", error);
    throw new HttpsError("internal", `ICD Token retrieval failed: ${error.message}`);
  }
});

// ==========================================
// ADMINISTRATIVE & RBAC FUNCTIONS
// ==========================================

export const syncUserPermissions = onCall(async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized: Global Admin required.");
  }
  const { email, role, country_id, assignedCountries, assignedClinics, isApproved } = request.data;
  if (!email || !role) {
    throw new HttpsError("invalid-argument", "Missing email or role.");
  }
  try {
    const admin = await getAdmin();
    const db = await getDb();
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
      email, role, country_id: country_id || null,
      assignedCountries: assignedCountries || [],
      assignedClinics: assignedClinics || [],
      isApproved: isApproved ?? false,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const deleteUser = onCall(async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  const { uid } = request.data;
  if (!uid) throw new HttpsError("invalid-argument", "Missing UID.");
  if (request.auth.uid === uid) {
    throw new HttpsError("failed-precondition", "You cannot delete yourself.");
  }
  try {
    const admin = await getAdmin();
    const db = await getDb();
    await admin.auth().deleteUser(uid);
    await db.collection("users").doc(uid).delete();
    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

// ==========================================
// DATA MANAGEMENT FUNCTIONS
// ==========================================

export const wipeTestData = onCall({ timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }

  const collections = ["patients", "encounters", "queues_active", "requisitions", "procurement_requests"];
  let totalDeleted = 0;
  const db = await getDb();

  for (const colName of collections) {
    let hasMore = true;
    while (hasMore) {
      const snapshot = await db.collection(colName).limit(500).get();
      if (snapshot.empty) {
        hasMore = false;
      } else {
        const batch = db.batch();
        snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snapshot.size;
      }
    }
  }
  return { success: true, deletedCount: totalDeleted };
});

export const wipeDemoData = onCall({ timeoutSeconds: 540 }, async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  const collectionsToWipe = ["patients", "encounters", "queues_active", "requisitions"];
  const db = await getDb();
  try {
    for (const colName of collectionsToWipe) {
      const snapshot = await db.collection(colName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }
    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const initClinics = onCall(async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  const clinicsToCreate = [
    { id: 'dhaka-main', name: 'Dhaka Main Clinic', country: 'Bangladesh', country_id: 'BD' },
    { id: 'cox-bazar', name: 'Cox\'s Bazar Relief Center', country: 'Bangladesh', country_id: 'BD' },
    { id: 'kutupalong', name: 'Kutupalong Camp Clinic', country: 'Bangladesh', country_id: 'BD' }
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
    created_at: (await getAdmin()).firestore.FieldValue.serverTimestamp()
  };

  try {
    const db = await getDb();
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
});

// ==========================================
// PATIENT CARE FUNCTIONS
// ==========================================

export const registerPatient = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  const { patientData, photoBase64, clinicId, country_id } = request.data as {
    patientData?: any;
    photoBase64?: string;
    clinicId?: string;
    country_id?: string;
  };

  if (!patientData || !clinicId || !country_id) {
    throw new HttpsError("invalid-argument", "Missing registration data: patientData, clinicId, or country_id.");
  }
  try {
    const crypto = await getCrypto();
    const admin = await getAdmin();
    const db = await getDb();
    const patientId = crypto.randomUUID();
    const encounterId = crypto.randomUUID();
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
      patient_id: patientId, clinic_id: clinicId, country_id: country_id, 
      status: 'WAITING_FOR_VITALS', created_at: new Date() 
    });
    
    const fullName = `${patientData.given_name || ''} ${patientData.family_name || ''}`.trim();
    batch.set(db.collection("queues_active").doc(), { 
      encounter_id: encounterId, patient_id: patientId, patient_name: fullName, 
      station: 'vitals', status: 'WAITING_FOR_VITALS', clinic_id: clinicId, 
      country_id: country_id, created_at: new Date(), updated_at: new Date() 
    });
    
    await batch.commit();
    return { patientId, encounterId };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const saveConsultation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  
  const data = request.data as {
    encounterId?: string;
    visitId?: string; // Support both terminologies
    patientId?: string;
    clinicId?: string;
    prescriptions?: any[];
    diagnosis?: string;
    notes?: string;
    treatment_notes?: string;
    labInvestigations?: any[];
    referrals?: any[];
    assessment?: any;
  };

  const vId = data.encounterId || data.visitId;
  if (!vId) throw new HttpsError("invalid-argument", "Missing encounterId (visitId).");
  
  const pId = data.patientId;
  if (!pId) throw new HttpsError("invalid-argument", "Missing patientId.");
  
  const cId = data.clinicId;
  if (!cId) throw new HttpsError("invalid-argument", "Missing clinicId.");

  const { 
    prescriptions = [], 
    diagnosis = "No diagnosis", 
    notes = "", 
    treatment_notes = "", 
    labInvestigations = [], 
    referrals = [], 
    assessment = {} 
  } = data;

  console.log(`HAEFA: Starting saveConsultation for Encounter ${vId}, Patient ${pId}`);

  const authUid = request.auth.uid;

  try {
    const db = await getDb();
    const admin = await getAdmin();
    
    // Log the sanitized input for debugging if needed (only in dev/debug)
    console.log(`HAEFA: saveConsultation payload keys: ${Object.keys(data).join(', ')}`);

    // GUARD CLAUSE for visitRef (encounterRef) - Local Narrowing Applied
    const visitRef = db.collection("encounters").doc(vId);

    // Standard Transaction Pattern: Reads first, then Writes
    return await db.runTransaction(async (transaction: any) => {
      console.log(`HAEFA: Transaction active for ${vId}`);

      // 1. PERFORM ALL READS
      const [encounterDoc, qSnap, userProfileDoc] = await Promise.all([
        transaction.get(visitRef),
        transaction.get(db.collection("queues_active").where("encounter_id", "==", vId).limit(1)),
        transaction.get(db.collection("users").doc(authUid))
      ]);

      if (!encounterDoc.exists) {
        throw new HttpsError("not-found", `Encounter ${vId} not found.`);
      }

      const userProfile = userProfileDoc.data() || {};
      const serverTime = admin.firestore.FieldValue.serverTimestamp();

      // 2. STAGE ALL WRITES
      
      // A. Update Encounter doc
      transaction.update(visitRef, sanitizeData({
        status: 'WAITING_FOR_PHARMACY',
        encounter_status: 'WAITING_FOR_PHARMACY',
        current_station: 'pharmacy',
        diagnosis,
        notes,
        last_updated: serverTime
      }));

      // B. Create Diagnosis Record
      const diagRef = db.collection("diagnoses").doc();
      transaction.set(diagRef, sanitizeData({
        encounter_id: vId,
        patient_id: pId,
        clinic_id: cId,
        diagnosis,
        notes,
        treatment_notes,
        labInvestigations,
        referrals,
        assessment,
        prescriber_name: userProfile.name || "Unknown Doctor",
        prescriber_reg_no: userProfile.professional_reg_no || "N/A",
        prescriber_body: userProfile.professional_body || "BMDC",
        prescriber_designation: userProfile.designation || "Medical Officer",
        created_at: serverTime
      }));

      // C. Create Prescription Record
      const presRef = db.collection("prescriptions").doc();
      transaction.set(presRef, sanitizeData({
        encounter_id: vId,
        patient_id: pId,
        clinic_id: cId,
        prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
        status: 'PENDING',
        created_at: serverTime
      }));

      // D. Handle Requisitions
      if (Array.isArray(prescriptions)) {
        for (const med of prescriptions) {
          if (med && med.isRequisition) {
            const reqRef = db.collection("requisitions").doc();
            transaction.set(reqRef, sanitizeData({
              clinic_id: cId,
              medication_name: med.medicationName,
              dosage: `${med.dosageValue}${med.dosageUnit}`,
              requested_qty: med.quantity,
              type: 'DOCTOR_ORDER_NON_STOCK',
              status: 'PENDING',
              created_at: serverTime
            }));
          }
        }
      }

      // E. Update Queue Entries
      if (!qSnap.empty) {
        qSnap.forEach((doc: any) => {
          transaction.update(doc.ref, sanitizeData({ 
            station: 'pharmacy',
            status: 'WAITING_FOR_PHARMACY',
            updated_at: serverTime 
          }));
        });
      }

      console.log(`HAEFA: Transaction commit staged for ${vId}`);
      return { success: true, encounterId: vId };
    });
  } catch (error: any) {
    console.error("HAEFA Critical error in saveConsultation:", error);
    
    if (error instanceof HttpsError) throw error;
    
    // Enhanced error reporting
    const errorMessage = error.message || "Unknown error";
    const errorStack = error.stack || "";
    console.error(`HAEFA Save Failure Detail: ${errorMessage}`, errorStack);
    
    throw new HttpsError("internal", `Consultation failed to save: ${errorMessage}`);
  }
});

// ==========================================
// PHARMACY & INVENTORY FUNCTIONS
// ==========================================

export const dispenseMedication = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  
  const data = request.data as {
    clinicId?: string;
    medications?: Array<{
      medication_name: string;
      mode: string;
      qty: number | string;
      inventoryId?: string;
      substitution?: string;
      return_on?: string;
    }>;
    encounterId?: string;
    visitId?: string;
    patientId?: string;
  };

  const cId = data.clinicId;
  const meds = data.medications;
  const vId = data.encounterId || data.visitId;
  const pId = data.patientId;

  if (!cId || !meds || !vId || !pId) {
    throw new HttpsError("invalid-argument", "Missing clinicId, medications, encounterId, or patientId.");
  }
  
  try {
    const db = await getDb();
    const admin = await getAdmin();
    const userProfile = (await db.collection("users").doc(request.auth.uid).get()).data() || {};

    const visitRef = db.collection("encounters").doc(vId);

    return await db.runTransaction(async (transaction: any) => {
      const results: any[] = [];

      for (const medication of meds) {
        logger.info('Processing Medication:', { medication });
        
        const { medication_name, mode, qty, substitution, return_on } = medication;
        const invId = medication.inventoryId; // Local Variable Narrowing
        
        const targetMedName = (mode === 'SUBSTITUTE' && substitution) ? substitution : medication_name;
        
        let actualDeducted = 0;

        if (mode !== 'OUT_OF_STOCK') {
          // GUARD CLAUSE: Ensure invId is provided for dispensing operations
          if (!invId) {
            throw new HttpsError("invalid-argument", `Medication ${medication_name} is missing inventoryId.`);
          }

          const inventoryRef = db.collection('clinics').doc(cId).collection('inventory').doc(invId);
          const inventoryDoc = await transaction.get(inventoryRef);

          if (!inventoryDoc.exists) {
            throw new HttpsError("not-found", `Inventory record ${inventoryId} not found in clinic ${clinicId}.`);
          }

          const available = Number(inventoryDoc.data()?.quantity) || 0;
          const toTake = Math.min(available, Number(qty));
          const newQty = available - toTake;
          
          transaction.update(inventoryRef, sanitizeData({ quantity: newQty }));
          actualDeducted = toTake;

          if (newQty < REQUISITION_THRESHOLD) {
            transaction.set(db.collection("requisitions").doc(), sanitizeData({
              clinic_id: cId, medication_name: targetMedName,
              current_stock: newQty, type: 'LOW_STOCK_ALERT', status: 'PENDING',
              created_at: admin.firestore.FieldValue.serverTimestamp()
            }));
          }
        }

        if (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') {
          transaction.set(db.collection("requisitions").doc(), sanitizeData({
            clinic_id: cId, patient_id: pId, medication_name: medication_name,
            type: 'PATIENT_IOU_SHORTFALL', status: 'WAITING_FOR_STOCK',
            return_date: return_on || null, encounter_id: vId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          }));
        }
        results.push(sanitizeData({ medication: medication_name, dispensed: actualDeducted, mode, substitution: substitution || null, return_on: return_on || null }));
      }

      // Update prescriptions record for this encounter
      const presQuery = db.collection("prescriptions").where("encounter_id", "==", vId).limit(1);
      const presSnap = await transaction.get(presQuery);
      if (!presSnap.empty) {
        const existingPres = presSnap.docs[0].data();
        transaction.update(presSnap.docs[0].ref, sanitizeData({
          status: 'DISPENSED',
          dispensedDate: existingPres.dispensedDate || admin.firestore.FieldValue.serverTimestamp(),
          dispenser_name: userProfile.name || "Unknown Pharmacist",
          dispenser_reg_no: userProfile.professional_reg_no || "N/A",
          dispenser_body: userProfile.professional_body || "PCB",
          dispensation_details: results,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }));
      }

      transaction.update(visitRef, sanitizeData({ 
        status: 'COMPLETED', last_updated: admin.firestore.FieldValue.serverTimestamp() 
      }));
      return { success: true, summary: results };
    });
  } catch (error: any) {
    logger.error("HAEFA Critical error in dispenseMedication:", error);
    const errorMessage = error.message || "Unknown error";
    throw new HttpsError("internal", `Dispensing failed: ${errorMessage}`);
  }
});

/**
 * BULK UPLOAD: Uses DYNAMIC IMPORT to prevent discovery timeouts
 */
export const bulkUpload = onCall(async (request) => {
  const { clinicId, fileBase64 } = request.data as {
    clinicId?: string;
    fileBase64?: string;
  };
  
  if (!clinicId || !fileBase64) {
    throw new HttpsError("invalid-argument", "Missing clinicId or file data.");
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  await workbook.xlsx.load(Buffer.from(fileBase64, 'base64') as any);
  const worksheet = workbook.getWorksheet(1);
  const db = await getDb();
  const admin = await getAdmin();
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
      med_id_lower: (medId || "").toLowerCase().replace(/\s+/g, ''), 
      dosage, quantity: qty, 
      created_at: admin.firestore.FieldValue.serverTimestamp() 
    });
  });
  await batch.commit();
  return { success: true };
});

export const getInventoryTemplate = onCall(async (request) => {
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
  return { fileBase64: (buffer as any).toString('base64') };
});

export const stockAlerts = onSchedule("every 24 hours", async (event) => {
  const ninetyDays = new Date(); ninetyDays.setDate(ninetyDays.getDate() + 90);
  const db = await getDb();
  const { Timestamp } = await import("firebase-admin/firestore");
  const clinics = await db.collection("clinics").get();
  for (const doc of clinics.docs) {
    const expiring = await db.collection(`clinics/${doc.id}/inventory`).where("expiry_date", "<=", Timestamp.fromDate(ninetyDays)).where("quantity", ">", 0).get();
    if (!expiring.empty) console.log(`Alert: ${expiring.size} expiring batches in ${doc.id}`);
  }
});
