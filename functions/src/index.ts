import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as ExcelJS from 'exceljs';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
//  const storage = admin.storage().bucket();

// --- RBAC syncUserPermissions ---
export const syncUserPermissions = onCall(
  {
    region: "us-central1",
    maxInstances: 10,
  },
  async (request: CallableRequest) => {
    // 1. Security Guard: Only allow global admins
    if (!request.auth || request.auth.token.role !== 'global_admin') {
      throw new HttpsError("permission-denied", "Only global admins can execute this function.");
    }

    const { email, role, countryCode, assignedCountries, assignedClinics, isApproved } = request.data;

    if (!email || !role) {
      throw new HttpsError("invalid-argument", "Missing required fields: email or role.");
    }

    try {
      // 2. Find target user's UID
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (error: any) {
        console.error("Error in getUserByEmail:", error);
        if (error.code === 'auth/user-not-found') {
          // Create user if not found
          userRecord = await admin.auth().createUser({ email });
        } else {
          throw error;
        }
      }
      const uid = userRecord.uid;

      // 3. Update Firestore user document
      // We keep the high-level role in Custom Claims for fast security rule checks
      await admin.auth().setCustomUserClaims(uid, { role });

      await db.collection("users").doc(uid).set({
        email,
        role,
        countryCode: countryCode || null,
        assignedCountries: assignedCountries || [],
        assignedClinics: assignedClinics || [],
        isApproved: isApproved ?? false,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return { success: true, message: `Permissions updated for ${email}` };
    } catch (error: any) {
      console.error("Error syncing permissions:", error);
      throw new HttpsError("internal", error.message || "Failed to sync permissions.");
    }
  }
);

export const migrateUsers = onCall(
  {
    region: "us-central1",
    maxInstances: 10,
  },
  async (request: CallableRequest) => {
    // 1. Security Guard: Only allow global admins
    if (!request.auth || request.auth.token.role !== 'global_admin') {
      throw new HttpsError("permission-denied", "Only global admins can execute this function.");
    }

    try {
      const usersSnapshot = await db.collection("users").get();
      const batch = db.batch();
      let count = 0;

      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        // Skip if already migrated
        if (data.isApproved !== undefined) return;

        batch.update(doc.ref, {
          countryCode: data.countryId || null,
          assignedCountries: [],
          assignedClinics: [],
          isApproved: false,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }

      return { success: true, message: `Migrated ${count} users.` };
    } catch (error: any) {
      console.error("Error migrating users:", error);
      throw new HttpsError("internal", error.message || "Failed to migrate users.");
    }
  }
);

// --- Restored Functions ---
export const bootstrapAdmins = onCall(async (request: CallableRequest) => {
  const admins = [
    { email: 'indranil_dutta@haefa.org', name: 'Indranil Dutta' },
    { email: 'ruhul_abid@haefa.org', name: 'Ruhul Abid' }
  ];

  for (const adminUser of admins) {
    try {
      const user = await admin.auth().getUserByEmail(adminUser.email);
      await admin.auth().setCustomUserClaims(user.uid, { role: 'global_admin' });
      await db.collection("users").doc(user.uid).set({
        email: adminUser.email,
        name: adminUser.name,
        role: 'global_admin',
        updated_at: new Date()
      }, { merge: true });
    } catch (error) {
      console.error(`Failed to bootstrap admin ${adminUser.email}:`, error);
    }
  }
  return { success: true };
});

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

export const registerPatient = onCall(async (request: CallableRequest) => {
  console.log("registerPatient called");
  
  const data = request.data || {};
  const { patientData, photoBase64, clinicId, countryCode } = data;
  
  if (!patientData || typeof patientData !== 'object') {
    throw new HttpsError("invalid-argument", "Missing or invalid patientData");
  }
  if (!clinicId) {
    throw new HttpsError("invalid-argument", "Missing clinicId");
  }
  if (!countryCode) {
    throw new HttpsError("invalid-argument", "Missing countryCode");
  }

  try {
    const patientId = generateId();
    const encounterId = generateId();

    // 1. Photo Upload
    let photoUrl = "";
    if (photoBase64 && typeof photoBase64 === 'string' && photoBase64.includes(",")) {
      try {
        console.log("Uploading photo for patient:", patientId);
        const bucket = admin.storage().bucket();
        const file = bucket.file(`patient_photos/${patientId}/photo.jpg`);
        const base64Data = photoBase64.split(",")[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, "base64");
          await file.save(buffer, { contentType: "image/jpeg" });
          const signedUrls = await file.getSignedUrl({ action: "read", expires: "03-01-2500" });
          photoUrl = signedUrls[0];
          console.log("Photo uploaded successfully");
        }
      } catch (error) {
        console.error("Error uploading photo (non-fatal):", error);
      }
    }

    // 2. Create Patient
    console.log("Creating patient document:", patientId);
    const sanitizedPatientData = sanitizeData(patientData);
    await db.collection("patients").doc(patientId).set({
      ...sanitizedPatientData,
      photo_url: photoUrl || "",
      created_at: new Date()
    });

    // 3. Create Encounter
    console.log("Creating encounter:", encounterId);
    await db.collection("encounters").doc(encounterId).set({
      patient_id: patientId,
      clinic_id: clinicId,
      country_code: countryCode,
      status: 'WAITING_FOR_VITALS',
      created_at: new Date()
    });

    // 4. Add to Queue
    console.log("Adding to queue.");
    const givenName = patientData.given_name || '';
    const familyName = patientData.family_name || '';
    const fullName = `${givenName} ${familyName}`.trim() || 'Unknown Patient';

    await db.collection("queues_active").add({
      encounter_id: encounterId,
      patient_id: patientId,
      patient_name: fullName,
      station: 'vitals',
      status: 'WAITING_FOR_VITALS',
      clinic_id: clinicId,
      country_code: countryCode,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log("Registration complete");
    return { 
      patientId, 
      encounterId, 
      photoUrl: photoUrl || "" 
    };
  } catch (error: any) {
    console.error("registerPatient failed:", error);
    throw new HttpsError("internal", error.message || "Registration failed");
  }
});

export const generateBadgeToken = onCall(async (request: CallableRequest) => {
  console.log("generateBadgeToken called");
  const data = request.data || {};
  const { patientId } = data;
  
  if (!patientId) {
    throw new HttpsError("invalid-argument", "Missing patientId");
  }

  try {
    const token = generateId();

    console.log("Creating badge token:", patientId);
    await db.collection("badge_tokens").doc(token).set({
      patient_id: patientId,
      created_at: new Date()
    });

    return { token };
  } catch (error: any) {
    console.error("generateBadgeToken failed:", error);
    throw new HttpsError("internal", error.message || "Badge token generation failed");
  }
});

export const dispenseMedication = onCall(async (request: CallableRequest) => {
  const { clinicId, patientId, encounterId, medications } = request.data;
  if (!clinicId || !patientId || !encounterId || !medications) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  return await db.runTransaction(async (transaction) => {
    for (const med of medications) {
      // 1. Find batches with FEFO
      const inventoryRef = db.collection(`clinics/${clinicId}/inventory`);
      const q = inventoryRef
        .where("medication_id", "==", med.medication_id)
        .where("quantity", ">", 0)
        .orderBy("expiry_date", "asc");
      
      const snapshot = await transaction.get(q);

      if (snapshot.empty) {
        throw new HttpsError("failed-precondition", `No stock for ${med.medication_id}`);
      }

      let remainingToDispense = med.quantity;
      for (const doc of snapshot.docs) {
        if (remainingToDispense <= 0) break;

        const batch = doc.data() as any;
        const available = batch.quantity;
        const toTake = Math.min(available, remainingToDispense);

        transaction.update(doc.ref, { quantity: available - toTake });
        remainingToDispense -= toTake;

        // 2. Log inventory log
        const logRef = db.collection("inventory_logs").doc();
        transaction.set(logRef, {
          clinic_id: clinicId,
          medication_id: med.medication_id,
          batch_id: batch.batch_id,
          type: 'dispense',
          quantity: toTake,
          user_id: request.auth?.uid,
          encounter_id: encounterId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (remainingToDispense > 0) {
        throw new HttpsError("failed-precondition", `Insufficient stock for ${med.medication_id}`);
      }
    }

    // 3. Update encounter status
    const encounterRef = db.collection("encounters").doc(encounterId);
    transaction.update(encounterRef, { encounter_status: 'COMPLETED' });

    return { success: true };
  });
});

export const bulkUpload = onCall(async (request: CallableRequest) => {
  const { clinicId, fileBase64 } = request.data;
  if (!clinicId || !fileBase64) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new HttpsError("internal", "Failed to load worksheet");
  }

  const batch = db.batch();
  worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
    if (rowNumber === 1) return; // Skip header
    const [medication_id, batch_id, expiry_date, quantity, base_unit, package_unit] = row.values as any[];
    
    const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
    batch.set(docRef, {
      medication_id,
      batch_id,
      expiry_date: Timestamp.fromDate(new Date(expiry_date)),
      quantity: Number(quantity),
      base_unit,
      package_unit,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  return { success: true };
});

export const stockAlerts = onSchedule("every 24 hours", async (event: ScheduledEvent) => {
  console.log("stockAlerts started");
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const clinicsSnapshot = await db.collection("clinics").get();
  for (const clinicDoc of clinicsSnapshot.docs) {
    const clinicId = clinicDoc.id;
    const inventorySnapshot = await db.collection(`clinics/${clinicId}/inventory`)
      .where("expiry_date", "<=", Timestamp.fromDate(ninetyDaysFromNow))
      .where("quantity", ">", 0)
      .get();

    if (!inventorySnapshot.empty) {
      console.log(`Alert: ${inventorySnapshot.size} expiring batches in clinic ${clinicId}`);
      // TODO: Send notification to clinic staff
    }
  }
});
