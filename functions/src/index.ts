import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as crypto from "crypto";

initializeApp();
const db = getFirestore();
const storage = getStorage();

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
        const bucket = storage.bucket();
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
      photoUrl: photoUrl || "",
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
    const firstName = patientData.first_name || '';
    const lastName = patientData.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Patient';

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

export const archiveOldData = onSchedule("every 24 hours", async (event: ScheduledEvent) => {
  console.log("archiveOldData started");
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const collections = ['encounters', 'vitals', 'diagnoses', 'prescriptions'];

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName)
      .where('created_at', '<', Timestamp.fromDate(ninetyDaysAgo))
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.create(db.collection(`${collectionName}_archive`).doc(doc.id), doc.data());
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Archived ${snapshot.size} documents from ${collectionName}`);
  }
});
