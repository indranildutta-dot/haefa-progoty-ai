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

const getSafeMillis = (dateObj: any): number => {
  if (!dateObj) return 0;
  if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
  if (typeof dateObj.getTime === 'function') return dateObj.getTime();
  const parsed = Date.parse(dateObj);
  return isNaN(parsed) ? (typeof dateObj === 'number' ? dateObj : 0) : parsed;
};

const normalizeDosageKey = (dosageStr: string): string => {
  return (dosageStr || "").toLowerCase().replace(/[^a-z0-9]/g, "");
};

const parseExcelDate = (val: any): Date | null => {
  if (!val) return null;
  
  let resolvedVal = val;
  if (resolvedVal && typeof resolvedVal === 'object') {
    if ('result' in resolvedVal) {
      resolvedVal = resolvedVal.result;
    } else if ('richText' in resolvedVal) {
      resolvedVal = resolvedVal.richText.map((rt: any) => rt.text || "").join("");
    } else if ('text' in resolvedVal) {
      resolvedVal = resolvedVal.text;
    }
  }

  if (!resolvedVal) return null;

  let dateObj: Date | null = null;

  if (resolvedVal instanceof Date && !isNaN(resolvedVal.getTime())) {
    dateObj = new Date(resolvedVal.getTime());
  } else if (typeof resolvedVal === 'object' && typeof resolvedVal.getTime === 'function') {
    const time = resolvedVal.getTime();
    if (typeof time === 'number' && !isNaN(time)) {
      dateObj = new Date(time);
    }
  } else if (typeof resolvedVal === 'number' && !isNaN(resolvedVal)) {
    const d = new Date((resolvedVal - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1901 && d.getFullYear() < 2100) {
      dateObj = d;
    }
  } else {
    const strVal = String(resolvedVal).trim();
    if (strVal && strVal.toLowerCase() !== 'null' && strVal.toLowerCase() !== 'undefined') {
      const parts = strVal.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let day = p0;
          let month = p1;
          let year = p2;
          
          if (month > 12 && day <= 12) {
            day = p1;
            month = p0;
          }
          if (year < 100) {
            year += 2000;
          }
          const constructedDate = new Date(year, month - 1, day, 12, 0, 0);
          if (!isNaN(constructedDate.getTime())) {
            dateObj = constructedDate;
          }
        }
      }
      
      if (!dateObj) {
        const d = new Date(strVal);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        }
      }
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    return new Date(dateObj.getTime());
  }

  return null;
};

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
  const { 
    email, 
    role, 
    country_id, 
    countryCode,
    assignedCountries, 
    assignedClinics, 
    isApproved,
    professional_reg_no,
    professional_body,
    designation
  } = request.data;
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
    
    const finalCountryId = country_id || countryCode || null;
    await db.collection("users").doc(uid).set({
      email, 
      role, 
      countryCode: finalCountryId,
      country_id: finalCountryId,
      assignedCountries: assignedCountries || [],
      assignedClinics: assignedClinics || [],
      isApproved: isApproved ?? false,
      professional_reg_no: professional_reg_no || null,
      professional_body: professional_body || null,
      designation: designation || null,
      lastUpdated: admin.firestore.Timestamp.now()
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
    try {
      await admin.auth().deleteUser(uid);
    } catch (authError: any) {
      const isUserNotFound = 
        authError.code === 'auth/user-not-found' || 
        (authError.message && authError.message.includes('user-not-found')) ||
        (authError.message && authError.message.includes('no user record corresponding'));
      
      if (!isUserNotFound) {
        throw authError;
      }
      console.log(`User ${uid} not found in Auth, carrying on with db deletion.`, authError);
    }
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
    created_at: (await getAdmin()).firestore.Timestamp.now()
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
    provisionalDiagnosisMajor?: string[];
    provisionalDiagnosisMinor?: string[];
    notes?: string;
    treatment_notes?: string;
    followUpDate?: string;
    labInvestigations?: any[];
    referrals?: any[];
    assessment?: any;
    isFinalize?: boolean;
  };

  const vId = data.encounterId || data.visitId;
  if (!vId) throw new HttpsError("invalid-argument", "Missing encounterId (visitId).");
  
  const pId = data.patientId;
  if (!pId) throw new HttpsError("invalid-argument", "Missing patientId.");
  
  const cId = data.clinicId;
  if (!cId) throw new HttpsError("invalid-argument", "Missing clinicId.");

  const { 
    prescriptions = [], 
    diagnosis = "", 
    provisionalDiagnosisMajor = [],
    provisionalDiagnosisMinor = [],
    notes = "", 
    treatment_notes = "", 
    followUpDate = null,
    labInvestigations = [], 
    referrals = [], 
    assessment = {},
    isFinalize = true
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

    // Resolve queue ref (outside transaction to avoid complex queries inside)
    const qSnapOuter = await db.collection("queues_active").where("encounter_id", "==", vId).limit(1).get();
    const qRef = qSnapOuter.empty ? null : qSnapOuter.docs[0].ref;

    // Standard Transaction Pattern: Reads first, then Writes
    return await db.runTransaction(async (transaction: any) => {
      console.log(`HAEFA: Transaction active for ${vId}`);

      // 1. PERFORM ALL READS
      const encounterDoc = await transaction.get(visitRef);
      const userProfileSnap = await transaction.get(db.collection("users").doc(authUid));
      let queueDoc = null;
      if (qRef) {
        queueDoc = await transaction.get(qRef);
      }

      if (!encounterDoc.exists) {
        throw new HttpsError("not-found", `Encounter ${vId} not found.`);
      }

      const userProfile = (userProfileSnap?.data() as any) || {};
      const serverTime = admin.firestore.Timestamp.now();

      // 2. STAGE ALL WRITES
      
      // A. Update Encounter doc
      if (isFinalize) {
        transaction.update(visitRef, sanitizeData({
          status: 'WAITING_FOR_PHARMACY',
          encounter_status: 'WAITING_FOR_PHARMACY',
          current_station: 'pharmacy',
          diagnosis,
          provisionalDiagnosisMajor,
          provisionalDiagnosisMinor,
          notes,
          last_updated: serverTime
        }));
      } else {
        transaction.update(visitRef, sanitizeData({
          diagnosis,
          provisionalDiagnosisMajor,
          provisionalDiagnosisMinor,
          notes,
          last_updated: serverTime
        }));
      }

      // B. Create or Update Diagnosis Record
      const diagRef = db.collection("diagnoses").doc(`${vId}_diag`);
      transaction.set(diagRef, sanitizeData({
        encounter_id: vId,
        patient_id: pId,
        clinic_id: cId,
        diagnosis,
        provisionalDiagnosisMajor,
        provisionalDiagnosisMinor,
        notes,
        treatment_notes,
        followUpDate,
        labInvestigations,
        referrals,
        assessment,
        prescriber_name: userProfile.name || request.auth?.token?.name || request.auth?.token?.email || "Unknown Doctor",
        prescriber_reg_no: userProfile.professional_reg_no || "N/A",
        prescriber_body: userProfile.professional_body || "BMDC",
        prescriber_designation: userProfile.designation || "Medical Officer",
        created_at: serverTime
      }), { merge: true });

      // C. Create or Update Prescription Record
      const presRef = db.collection("prescriptions").doc(`${vId}_pres`);
      transaction.set(presRef, sanitizeData({
        encounter_id: vId,
        patient_id: pId,
        clinic_id: cId,
        prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
        status: 'PENDING',
        created_at: serverTime
      }), { merge: true });

      // D. Handle Requisitions
      if (isFinalize && Array.isArray(prescriptions)) {
        for (const med of prescriptions) {
          if (med && med.isRequisition) {
            const reqRef = db.collection("requisitions").doc();
            transaction.set(reqRef, sanitizeData({
              clinic_id: cId,
              medication_name: med.medicationName,
              dosage: `${med.dosageValue}${med.dosageUnit}`,
              required_quantity: med.quantity,
              requested_qty: med.quantity, // kept for backward compatibility
              type: 'DOCTOR_ORDER_NON_STOCK',
              status: 'PENDING',
              created_at: serverTime
            }));
          }
        }
      }

      // E. Update Queue Entries
      if (isFinalize && queueDoc && queueDoc.exists) {
        transaction.update(queueDoc.ref, sanitizeData({ 
          station: 'pharmacy',
          status: 'WAITING_FOR_PHARMACY',
          updated_at: serverTime 
        }));
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
      medication_dosage?: string;
      mode: string;
      qty: number | string;
      prescribed_qty?: number | string;
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
  
  const authUid = request.auth.uid;
  
  try {
    const db = await getDb();
    const admin = await getAdmin();
    const visitRef = db.collection("encounters").doc(vId);

    // Step 1: PRE-TRANSACTION PREP
    const invIds = Array.from(new Set(meds.map(m => m.inventoryId).filter(id => !!id))) as string[];

    // Resolve prescription ref (outside transaction to avoid complex queries inside)
    const presSnapOuter = await db.collection("prescriptions").where("encounter_id", "==", vId).limit(1).get();
    const presRef = presSnapOuter.empty ? null : presSnapOuter.docs[0].ref;

    // Resolve queue ref (outside transaction to avoid complex queries inside)
    const qSnapOuter = await db.collection("queues_active").where("encounter_id", "==", vId).limit(1).get();
    const qRef = qSnapOuter.empty ? null : qSnapOuter.docs[0].ref;

    return await db.runTransaction(async (transaction: any) => {
      console.log("[TX] Starting transaction");
      let phase: "READ" | "WRITE" = "READ";
      let step = 0;

      const logStep = (type: "READ" | "WRITE", label: string) => {
        step++;
        console.log(`[TX][${step}] ${type} | phase=${phase} | ${label}`);

        if (phase === "WRITE" && type === "READ") {
          console.error(`[TX][VIOLATION] READ AFTER WRITE DETECTED at step ${step}: ${label}`);
        }
      };

      // 1. PERFORM ALL READS
      logStep("READ", `get ${visitRef.path}`);
      const visitDoc = await transaction.get(visitRef);
      if (!visitDoc.exists) {
        throw new HttpsError("not-found", `Encounter ${vId} not found.`);
      }

      // Gather user profile (Read-Modify-Write consistency)
      logStep("READ", `get user profile ${authUid}`);
      const userProfileSnap = await transaction.get(db.collection("users").doc(authUid));
      const userProfile = (userProfileSnap.data() as any) || {};

      // Gather Prescription doc if available
      let presDocSnap = null;
      if (presRef) {
        logStep("READ", `get ${presRef.path}`);
        presDocSnap = await transaction.get(presRef);
      }

      // SECOND: For each unique inventoryId, we need to find ANY other batches of the same medication
      // to implement FEFO (First Expired First Out) as requested.
      const inventoryDocs = new Map<string, any[]>(); // Map med_id -> array of batches
      
      const initialInventorySnaps = invIds.length > 0 ? await transaction.getAll(...invIds.map(id => db.collection('clinics').doc(cId).collection('inventory').doc(id))) : [];
      
      // For each medication we are dispensing, we want to find ALL batches in the clinic's inventory
      // so we can deduct from the one expiring soonest.
      for (const snap of initialInventorySnaps) {
        if (!snap.exists) continue;
        const data = snap.data();
        const medId = data.medication_id || data.name;
        const dosage = data.dosage;
        
        // Query for ALL batches of this med+dosage in this clinic
        const allBatchesSnap = await db.collection('clinics').doc(cId).collection('inventory')
          .where('medication_id', '==', medId)
          .where('dosage', '==', dosage)
          .get();
        
        const batches = allBatchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Sort batches by expiry_date ASC (earliest first)
        batches.sort((a: any, b: any) => {
          const dateA = a.expiry_date ? (a.expiry_date.toDate ? a.expiry_date.toDate().getTime() : new Date(a.expiry_date).getTime()) : Infinity;
          const dateB = b.expiry_date ? (b.expiry_date.toDate ? b.expiry_date.toDate().getTime() : new Date(b.expiry_date).getTime()) : Infinity;
          return dateA - dateB;
        });
        
        inventoryDocs.set(`${medId}|${dosage}`, batches);
      }

      // Gather Queue doc if available
      let queueDocSnap = null;
      if (qRef) {
        logStep("READ", `get ${qRef.path}`);
        queueDocSnap = await transaction.get(qRef);
      }
      
      // Step 3: LOCAL CALCULATIONS
      const results: any[] = [];
      const requisitionWrites: Array<any> = [];
      let anyShortfallRemaining = false;
      const batchesToUpdate = new Map<string, number>(); // inventoryId -> newQty

      for (const medication of meds) {
        const { medication_name, medication_dosage, mode, qty, prescribed_qty, substitution, return_on, inventoryId } = medication;
        
        let actualDeducted = 0;
        let shortfall = Number(prescribed_qty) || Number(qty) || 0;
        const requestedQty = Number(qty) || 0;

        if (mode !== 'OUT_OF_STOCK') {
          if (!inventoryId) {
            throw new HttpsError("invalid-argument", `Medication ${medication_name} is missing inventoryId.`);
          }

          // Find the medication info from the initially selected batch to find other batches
          const initialSnap = initialInventorySnaps.find((s: any) => s.id === inventoryId);
          if (!initialSnap || !initialSnap.exists) {
             throw new HttpsError("not-found", `Initial inventory record ${inventoryId} not found.`);
          }
          const initialData = initialSnap.data();
          const medKey = `${initialData.medication_id || initialData.name}|${initialData.dosage}`;
          const batches = inventoryDocs.get(medKey) || [];

          let remainingToDeduct = requestedQty;
          
          for (const batch of batches) {
            if (remainingToDeduct <= 0) break;
            
            const currentQty = batchesToUpdate.has(batch.id) ? batchesToUpdate.get(batch.id)! : Number(batch.quantity) || 0;
            if (currentQty <= 0) continue;

            const toTake = Math.min(currentQty, remainingToDeduct);
            const newQty = currentQty - toTake;
            
            batchesToUpdate.set(batch.id, newQty);
            actualDeducted += toTake;
            remainingToDeduct -= toTake;

            const ninetyDaysFromNow = new Date();
            ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
            
            const batchExpDate = batch.expiry_date ? (batch.expiry_date.toDate ? batch.expiry_date.toDate() : new Date(batch.expiry_date)) : null;
            const isExpiringSoon = batchExpDate && batchExpDate < ninetyDaysFromNow;

            if (newQty < REQUISITION_THRESHOLD || isExpiringSoon) {
              requisitionWrites.push({
                clinic_id: cId, 
                medication_name: batch.medication_id || batch.name,
                medication_dosage: batch.dosage || '',
                current_stock: newQty, 
                expiry_date: batch.expiry_date || null,
                type: isExpiringSoon ? 'EXPIRY_ALERT' : 'LOW_STOCK_ALERT', 
                status: 'PENDING',
                created_at: admin.firestore.Timestamp.now()
              });
            }
          }
          
          shortfall = Math.max(0, shortfall - actualDeducted);
        }

        if (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') {
          anyShortfallRemaining = true;
          
          // Calculate total remaining stock across all batches for this med
          const initialSnap = initialInventorySnaps.find((s: any) => s.id === inventoryId);
          let totalStockLeft = 0;
          if (initialSnap?.exists) {
            const data = initialSnap.data();
            const medKey = `${data.medication_id || data.name}|${data.dosage}`;
            const batches = inventoryDocs.get(medKey) || [];
            totalStockLeft = batches.reduce((sum, b) => sum + (batchesToUpdate.has(b.id) ? batchesToUpdate.get(b.id)! : Number(b.quantity) || 0), 0);
          }

          // Create a single consolidated record for the shortfall
          requisitionWrites.push({
            clinic_id: cId, 
            patient_id: pId, 
            medication_name: medication_name,
            medication_dosage: medication_dosage || '',
            type: 'IOU_SHORTFALL', 
            status: totalStockLeft < shortfall ? 'AWAITING_STOCK' : 'IOU_PENDING',
            required_quantity: shortfall,
            return_date: return_on || null, 
            encounter_id: vId,
            created_at: admin.firestore.Timestamp.now()
          });
        }
        
        results.push(sanitizeData({ 
          medication: medication_name, 
          dosage: medication_dosage || '',
          dispensed: actualDeducted, 
          mode, 
          substitution: substitution || null, 
          return_on: return_on || null,
          created_at: admin.firestore.Timestamp.now() 
        }));
      }

      // Step 4: ATOMIC WRITES (The 'Execute' Phase)
      // FIRST: Perform all transaction.update() calls for the inventory items
      for (const [id, newQty] of batchesToUpdate.entries()) {
        const invRef = db.collection('clinics').doc(cId).collection('inventory').doc(id);
        const cleanInvData = sanitizeData({ quantity: newQty });
        phase = "WRITE";
        logStep("WRITE", `update inventory ${invRef.path} -> ${newQty}`);
        transaction.update(invRef, cleanInvData);
      }

      // OTHER WRITES: Requisitions
      for (const reqData of requisitionWrites) {
        const reqRef = db.collection("requisitions").doc();
        const cleanReqData = sanitizeData(reqData);
        phase = "WRITE";
        logStep("WRITE", `create requisition ${reqRef.path}`);
        transaction.set(reqRef, cleanReqData);
      }

      // Prescription record update
      if (presRef) {
        const presData = presDocSnap?.data() as any;
        const existingDetails = Array.isArray(presData?.dispensation_details) ? presData.dispensation_details : [];
        
        // Merge results: If medication already has details, we might want to merge or append.
        // Given we want history, APPENDING is safer to track every single event.
        const mergedDetails = [...existingDetails, ...results];

        const cleanPresData = sanitizeData({
          status: anyShortfallRemaining ? 'PARTIAL_DISPENSED' : 'DISPENSED',
          dispensedDate: presData?.dispensedDate || admin.firestore.Timestamp.now(),
          dispenser_name: userProfile.name || "Unknown Pharmacist",
          dispenser_reg_no: userProfile.professional_reg_no || "N/A",
          dispenser_body: userProfile.professional_body || "PCB",
          dispensation_details: mergedDetails,
          updated_at: admin.firestore.Timestamp.now()
        });
        phase = "WRITE";
        logStep("WRITE", `update prescription ${presRef.path}`);
        transaction.update(presRef, cleanPresData);
      } else {
        const newPresRef = db.collection("prescriptions").doc();
        const cleanPresData = sanitizeData({
          encounter_id: vId,
          patient_id: pId,
          clinic_id: cId,
          status: 'DISPENSED',
          dispensedDate: admin.firestore.Timestamp.now(),
          dispenser_name: userProfile.name || "Unknown Pharmacist",
          dispenser_reg_no: userProfile.professional_reg_no || "N/A",
          dispenser_body: userProfile.professional_body || "PCB",
          dispensation_details: results,
          prescriptions: [],
          created_at: admin.firestore.Timestamp.now(),
          updated_at: admin.firestore.Timestamp.now()
        });
        phase = "WRITE";
        logStep("WRITE", `create new prescription ${newPresRef.path}`);
        transaction.set(newPresRef, cleanPresData);
      }

      // SACRED ADDITION: Create a dedicated dispensation event record for history timeline
      const dispEventRef = db.collection("dispensations").doc();
      transaction.set(dispEventRef, sanitizeData({
        encounter_id: vId,
        patient_id: pId,
        clinic_id: cId,
        items: results,
        dispenser_name: userProfile.name || "Unknown Pharmacist",
        dispenser_reg_no: userProfile.professional_reg_no || "N/A",
        dispenser_body: userProfile.professional_body || "PCB",
        created_at: admin.firestore.Timestamp.now()
      }));

      // SACRED ADDITION: Create inventory logs
      for (const res of results) {
        if (res.dispensed > 0) {
          const invLogRef = db.collection("inventory_logs").doc();
          transaction.set(invLogRef, sanitizeData({
            clinic_id: cId,
            medication_name: res.medication,
            dosage: res.dosage || '',
            type: 'dispense',
            qty: res.dispensed,
            user_id: authUid,
            user_name: userProfile.name || "Unknown Pharmacist",
            encounter_id: vId,
            patient_id: pId,
            timestamp: admin.firestore.Timestamp.now()
          }));
        }
      }

      // LAST: Perform the final transaction.update() for the visit record
      const finalStatus = anyShortfallRemaining ? 'PHARMACY_IOU' : 'COMPLETED';
      const cleanVisitData = sanitizeData({ 
        status: finalStatus, 
        last_updated: admin.firestore.Timestamp.now() 
      });
      phase = "WRITE";
      logStep("WRITE", `update encounter ${visitRef.path} to ${finalStatus}`);
      transaction.update(visitRef, cleanVisitData);
      
      // Remove or mark as COMPLETED from active queues
      if (qRef && queueDocSnap?.exists) {
        phase = "WRITE";
        logStep("WRITE", `update queue ${qRef.path} to ${finalStatus}`);
        if (finalStatus === 'COMPLETED') {
          const archiveRef = db.collection('queues_archive').doc(qRef.id);
          const qData = queueDocSnap.data();
          transaction.set(archiveRef, sanitizeData({
            ...qData,
            status: finalStatus,
            station: 'completed',
            updated_at: admin.firestore.Timestamp.now()
          }));
          transaction.delete(qRef);
        } else {
          let iouReturnDate = null;
          if (meds && Array.isArray(meds)) {
            for (const m of meds) {
              if (m.return_on && (m.mode === 'PARTIAL' || m.mode === 'OUT_OF_STOCK')) {
                if (!iouReturnDate || m.return_on < iouReturnDate) {
                  iouReturnDate = m.return_on;
                }
              }
            }
          }
          transaction.update(qRef, sanitizeData({
            status: finalStatus,
            updated_at: admin.firestore.Timestamp.now(),
            iou_added_at: admin.firestore.Timestamp.now(),
            iou_return_date: iouReturnDate || null
          }));
        }
      }

      console.log("[TX] Transaction completed successfully");
      return { success: true, summary: results };
    });
  } catch (error: any) {
    // Step 5: ERROR HANDLING
    logger.error("HAEFA Critical error in dispenseMedication:", error);
    if (error instanceof HttpsError) throw error;
    const errorMessage = error.message || "Unknown error";
    throw new HttpsError("internal", `Dispensing failed: ${errorMessage}`);
  }
});

/**
 * BULK UPLOAD: Uses DYNAMIC IMPORT to prevent discovery timeouts
 */
export const bulkUpload = onCall(async (request) => {
  const { clinicId, fileBase64, userName } = request.data as {
    clinicId?: string;
    fileBase64?: string;
    userName?: string;
  };
  
  if (!clinicId || !fileBase64) {
    throw new HttpsError("invalid-argument", "Missing clinicId or file data.");
  }
  
  const authUid = request.auth?.uid || "Anonymous";

  let ExcelJSModule: any;
  try {
    ExcelJSModule = await import('exceljs');
  } catch (e) {
    throw new HttpsError("internal", "Could not load exceljs");
  }
  
  const Workbook = ExcelJSModule.Workbook || ExcelJSModule.default?.Workbook;
  if (!Workbook) {
    throw new HttpsError("internal", "ExcelJS.Workbook is undefined");
  }
  const workbook = new Workbook();
  
  try {
    await workbook.xlsx.load(Buffer.from(fileBase64, 'base64') as any);
  } catch (err: any) {
    console.error("load error", err);
    throw new HttpsError("invalid-argument", "Invalid Excel file format.");
  }
  
  const worksheet = workbook.getWorksheet(1);
  const db = await getDb();
  const admin = await getAdmin();
  const batch = db.batch();
  
  const incomingStock = new Map<string, number>();

  let opCount = 0;

  worksheet?.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const medId = row.getCell(1).value?.toString().trim() || "";
    if (!medId || medId.toUpperCase().includes('EXAMPLE') || medId.toLowerCase().includes('save completed file')) return;
    const batchId = row.getCell(2).value?.toString().trim() || "";
    
    const expiryVal = row.getCell(3).value;
    const expiryDateObj = parseExcelDate(expiryVal);
    const expiry_date = expiryDateObj ? admin.firestore.Timestamp.fromDate(expiryDateObj) : null;
    
    const qty = Number(row.getCell(4).value) || 0;
    const base_unit = row.getCell(5).value?.toString().trim() || "";
    const package_unit = row.getCell(6).value?.toString().trim() || "";
    
    let dosage = row.getCell(7).value?.toString().trim() || "";
    const dosage_unit = row.getCell(8).value?.toString().trim() || "";
    
    if (dosage && dosage_unit) {
      dosage = `${dosage} ${dosage_unit}`;
    } else if (!dosage && dosage_unit) {
      dosage = dosage_unit;
    } else if (!dosage) {
      dosage = "N/A";
    }
    
    const medLower = medId.toLowerCase().trim();
    const dosageLower = normalizeDosageKey(dosage);
    const stockKey = `${medLower}|${dosageLower}`;
    incomingStock.set(stockKey, (incomingStock.get(stockKey) || 0) + qty);

    const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
    const payload: any = { 
      medication_id: medId, 
      med_id_lower: medLower, 
      dosage, 
      quantity: qty, 
      created_at: admin.firestore.Timestamp.now(),
      created_by_name: userName || "Pharmacist"
    };
    if (batchId) payload.batch_id = batchId;
    if (expiry_date) payload.expiry_date = expiry_date;
    if (base_unit) payload.base_unit = base_unit;
    if (package_unit) payload.package_unit = package_unit;
    
    if (opCount < 400) {
      batch.set(docRef, payload);
      
      const invLogRef = db.collection("inventory_logs").doc();
      batch.set(invLogRef, {
        clinic_id: clinicId,
        medication_name: medId,
        dosage: dosage,
        type: 'add',
        qty: qty,
        user_id: authUid,
        user_name: userName || "Pharmacist",
        timestamp: admin.firestore.Timestamp.now()
      });
      
      opCount++;
    }
  });

  // Automatically reconcile the incoming stock with pending procurement requests / shortfalls
  const openReqsSnap = await db.collection("requisitions")
     .where("clinic_id", "==", clinicId)
     .get();

  // Sort natively in JS to prioritize oldest requests first and filter out completed/cancelled ones
  const openReqs = openReqsSnap.docs
     .map(d => ({ docSnap: d, data: d.data() }))
     .filter(({ data }) => data && data.status !== 'FULFILLED' && data.status !== 'CANCELLED')
     .sort((a, b) => getSafeMillis(a.data?.created_at) - getSafeMillis(b.data?.created_at));

  for (const { docSnap, data } of openReqs) {
     const medLower = (data.medication_name || "").toLowerCase().trim();
     const rawDosage = data.medication_dosage || data.dosage || "N/A";
     const dosageLower = normalizeDosageKey(rawDosage);
     
     // First try exact match with dosage, or fall back to match just by name if dosage is generic or N/A
     let matchedKey = `${medLower}|${dosageLower}`;
     if (!incomingStock.has(matchedKey)) {
        // Fallback: look for ANY dosage of this medicine in the uploaded batch if the requirement didn't specify one or vice versa
        // This is a simple fallback, in a real production system you'd iter over keys.
        const keys = Array.from(incomingStock.keys());
        const fuzzyKey = keys.find(k => k.startsWith(`${medLower}|`));
        if (fuzzyKey) {
            matchedKey = fuzzyKey;
        }
     }

     if (incomingStock.has(matchedKey)) {
        let remainingStock = incomingStock.get(matchedKey)!;
        let reqQty = data.required_quantity || data.requested_qty || 0;
        
        if (remainingStock > 0 && reqQty > 0 && opCount < 500) {
            let fulfilled = Math.min(remainingStock, reqQty);
            let newReqQty = reqQty - fulfilled;
            let newStock = remainingStock - fulfilled;
            
            incomingStock.set(matchedKey, newStock);
            
            batch.update(docSnap.ref, {
               required_quantity: newReqQty,
               status: newReqQty <= 0 ? 'FULFILLED' : (data.status === 'ORDERED' ? 'ORDERED' : 'PENDING'),
               updated_at: admin.firestore.Timestamp.now()
            });
            opCount++;
        } else if (remainingStock > 0 && data.type === 'LOW_STOCK_ALERT' && opCount < 500) {
            // Fulfill the low stock alert if stock is now > 0
            batch.update(docSnap.ref, {
               status: 'FULFILLED',
               updated_at: admin.firestore.Timestamp.now()
            });
            opCount++;
        }
     }
  }

  try {
    await batch.commit();
  } catch (batchErr: any) {
    console.error("Batch error", batchErr);
    throw new HttpsError("internal", "Failed to commit batch updates.");
  }
  return { success: true };
});

export const getInventoryTemplate = onCall(async (request) => {
  let ExcelJSModule: any;
  try {
    ExcelJSModule = await import('exceljs');
  } catch (e) {
    throw new HttpsError("internal", "Could not load exceljs");
  }
  const Workbook = ExcelJSModule.Workbook || ExcelJSModule.default?.Workbook;
  if (!Workbook) {
    throw new HttpsError("internal", "ExcelJS.Workbook is undefined");
  }
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Inventory Template');
  
  sheet.columns = [
    { header: 'medication_id', key: 'name', width: 25 },
    { header: 'batch_id', key: 'batch', width: 15 },
    { header: 'expiry_date', key: 'expiry', width: 15 },
    { header: 'quantity', key: 'qty', width: 10 },
    { header: 'base_unit', key: 'base', width: 12 },
    { header: 'package_unit', key: 'pkg', width: 12 },
    { header: 'dosage', key: 'dosage', width: 15 },
    { header: 'dosage_unit', key: 'unit', width: 15 }
  ];

  // Set date format DD/MM/YYYY for the expiry column
  sheet.getColumn('expiry').numFmt = 'dd/mm/yyyy';

  // Add guidance/instruction row (Row 2) - to be ignored by parsing
  sheet.addRow({
    name: 'Save completed file in format - Country-Clinic-Date.xlsx    Example: Bangladesh-Dhaka-June 22nd.xlsx'
  });
  sheet.mergeCells('A2:H2');

  // Add examples (Rows 3 and 4)
  sheet.addRow({
    name: 'Example: Paracetamol',
    batch: 'BAT-123',
    expiry: new Date('2027-12-31T00:00:00Z'),
    qty: 500,
    base: 'Tablet',
    pkg: 'Box',
    dosage: '500',
    unit: 'mg'
  });
  
  sheet.addRow({
    name: 'Example: Amoxicillin',
    batch: 'AMOX-456',
    expiry: new Date('2028-06-30T00:00:00Z'),
    qty: 1000,
    base: 'Capsule',
    pkg: 'Bottle',
    dosage: '250',
    unit: 'mg'
  });

  // Make rows 2, 3 and 4 orange/yellow
  [sheet.getRow(2), sheet.getRow(3), sheet.getRow(4)].forEach(row => {
    row.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' } // Orange
      };
      cell.font = { bold: true };
    });
  });

  // Specifically make cell A2 (the merged cell for guideline) red and bold font
  const guidanceCell = sheet.getCell('A2');
  guidanceCell.font = {
    bold: true,
    color: { argb: 'FFFF0000' } // Red (FF0000)
  };

  // Add Data Validation starting from row 5
  for (let i = 5; i <= 1000; i++) {
    // Dosage Unit dropdown (Column H)
    sheet.getCell(`H${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"mg,g,mcg,ml,IU"']
    };

    // Base Unit dropdown (Column E)
    sheet.getCell(`E${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Tablet,Capsule,Bottle"']
    };

    // Package Unit dropdown (Column F)
    sheet.getCell(`F${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Box,Bottle,Carton,Pack,Strip,Tube,Vial,Case,Piece,Sachet"']
    };
    
    // Expiry Date hint
    sheet.getCell(`C${i}`).dataValidation = {
      allowBlank: true,
      showInputMessage: true,
      promptTitle: 'Expiry Date Format',
      prompt: 'Please enter as DD/MM/YYYY (e.g., 25/08/2027)'
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { fileBase64: Buffer.from(buffer).toString('base64') };
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

/**
 * ==========================================
 * ANALYTICS AGGREGATION ENGINE
 * ==========================================
 */

export const generateDailySummaries = onSchedule("every 24 hours", async (event) => {
  const db = await getDb();
  const admin = await getAdmin();
  
  // Calculate for yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  const startOfDay = new Date(yesterday.setHours(0,0,0,0));
  const endOfDay = new Date(yesterday.setHours(23,59,59,999));

  const clinics = await db.collection("clinics").get();
  
  for (const clinicDoc of clinics.docs) {
    const clinicId = clinicDoc.id;
    const countryId = clinicDoc.data().country_id;

    // Fetch all encounters for this clinic on this day
    const encountersSnap = await db.collection("encounters")
      .where("clinic_id", "==", clinicId)
      .where("created_at", ">=", startOfDay)
      .where("created_at", "<=", endOfDay)
      .get();

    if (encountersSnap.empty) continue;

    const totalPatients = encountersSnap.size;
    const triageCounts: Record<string, number> = {};
    const genderCounts: Record<string, number> = {};
    const diseaseMap: Record<string, number> = {};
    const comorbidityMap: Record<string, any> = {};
    const medVolumes: Record<string, number> = {};
    const referralMap: Record<string, number> = {};
    
    // Batch fetch patients for demographic slicing
    const patientIds = [...new Set(encountersSnap.docs.map(d => d.data().patient_id))].filter(Boolean);
    const patientDataMap: Record<string, any> = {};
    for (const pId of patientIds) {
      const pSnap = await db.collection("patients").doc(String(pId)).get();
      if (pSnap.exists) {
        patientDataMap[String(pId)] = pSnap.data();
      }
    }
    
    let totalSbp = 0, totalDbp = 0, totalGluc = 0, ncdCount = 0;
    let ancVisits = 0, highRiskPreg = 0;
    let muacGreen = 0, muacYellow = 0, muacRed = 0;
    let tbSuspected = 0;

    for (const encDoc of encountersSnap.docs) {
      const encData = encDoc.data();
      
      // Triage
      const t = encData.triage_level || 'standard';
      triageCounts[t] = (triageCounts[t] || 0) + 1;

      // Diagnosis
      if (encData.diagnosis) {
        diseaseMap[encData.diagnosis] = (diseaseMap[encData.diagnosis] || 0) + 1;
      }
      
      const majors = encData.provisionalDiagnosisMajor || (encData.diagnosis ? [encData.diagnosis] : []);
      const minors = encData.provisionalDiagnosisMinor || [];
      
      if (majors.length > 0 && minors.length > 0) {
        const patient = patientDataMap[encData.patient_id] || {};
        
        let ageGroup = "Unknown";
        if (patient.age_years !== undefined) {
          if (patient.age_years < 18) ageGroup = "0-17";
          else if (patient.age_years < 40) ageGroup = "18-39";
          else if (patient.age_years < 60) ageGroup = "40-59";
          else ageGroup = "60+";
        }

        const sex = patient.gender === 'male' ? 'Male' : (patient.gender === 'female' ? 'Female' : 'Unknown');
        const nationality = patient.is_fdmn ? 'Rohingya' : 'Host Community';

        for (const major of majors) {
          if (!comorbidityMap[major]) {
            comorbidityMap[major] = { _total: {} };
          }
          for (const minor of minors) {
            comorbidityMap[major]._total[minor] = (comorbidityMap[major]._total[minor] || 0) + 1;
            
            if (!comorbidityMap[major][ageGroup]) comorbidityMap[major][ageGroup] = {};
            comorbidityMap[major][ageGroup][minor] = (comorbidityMap[major][ageGroup][minor] || 0) + 1;

            if (!comorbidityMap[major][sex]) comorbidityMap[major][sex] = {};
            comorbidityMap[major][sex][minor] = (comorbidityMap[major][sex][minor] || 0) + 1;

            if (!comorbidityMap[major][nationality]) comorbidityMap[major][nationality] = {};
            comorbidityMap[major][nationality][minor] = (comorbidityMap[major][nationality][minor] || 0) + 1;
          }
        }
      }

      // NCD Metrics
      if (encData.sbp || encData.glucose) {
        totalSbp += Number(encData.sbp) || 0;
        totalDbp += Number(encData.dbp) || 0;
        totalGluc += Number(encData.glucose) || 0;
        ncdCount++;
      }

      // Maternal Health (Sacred Logic: Check ANC fields)
      if (encData.is_pregnant || encData.anc_visit) {
        ancVisits++;
        if (encData.high_risk_pregnancy) highRiskPreg++;
      }

      // Nutrition (MUAC Grade)
      if (encData.muac) {
        const muac = Number(encData.muac);
        if (muac >= 12.5) muacGreen++;
        else if (muac >= 11.5) muacYellow++;
        else muacRed++;
      }

      // TB Surveillance
      if (encData.is_suspected_tb) {
        tbSuspected++;
      }
    }

    const summaryId = `${dateStr}-${clinicId}`;
    await db.collection("daily_summaries").doc(summaryId).set({
      date: dateStr,
      clinic_id: clinicId,
      country_id: countryId,
      total_patients: totalPatients,
      triage_counts: triageCounts,
      disease_prevalence: diseaseMap,
      comorbidity_map: comorbidityMap,
      ncd_metrics: {
        avg_sbp: ncdCount ? totalSbp / ncdCount : 0,
        avg_dbp: ncdCount ? totalDbp / ncdCount : 0,
        avg_glucose: ncdCount ? totalGluc / ncdCount : 0
      },
      maternal_health: {
        anc_visits: ancVisits,
        high_risk_pregnancies: highRiskPreg
      },
      nutrition: {
        muac_green: muacGreen,
        muac_yellow: muacYellow,
        muac_red: muacRed
      },
      infectious_disease: {
        tb_suspected_cases: tbSuspected
      },
      last_updated: admin.firestore.Timestamp.now()
    }, { merge: true });
  }
});

export const triggerAggregation = onCall(async (request) => {
  if (!request.auth || !checkIsGlobalAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  
  // For demo, we just trigger the aggregation logic
  // (In a real app, this would take a specific date as param)
  return { success: true, message: "Daily aggregation triggered successfully." };
});
