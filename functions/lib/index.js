"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBadgeToken = exports.registerPatient = exports.bootstrapAdmins = exports.syncUserPermissions = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
exports.syncUserPermissions = (0, https_1.onCall)({
    region: "us-central1",
    maxInstances: 10,
}, async (request) => {
    if (!request.auth || request.auth.token.role !== 'global_admin') {
        throw new https_1.HttpsError("permission-denied", "Only global admins can execute this function.");
    }
    const { email, role, assignedCountry, assignedClinicId } = request.data;
    if (!email || !role || !assignedCountry || !assignedClinicId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields: email, role, assignedCountry, or assignedClinicId.");
    }
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        await admin.auth().setCustomUserClaims(uid, {
            role,
            assignedCountry,
            assignedClinicId
        });
        await db.collection("users").doc(uid).set({
            email,
            role,
            assignedCountry,
            assignedClinicId,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true, message: `Permissions updated for ${email}` };
    }
    catch (error) {
        console.error("Error syncing permissions:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to sync permissions.");
    }
});
exports.bootstrapAdmins = (0, https_1.onCall)(async (request) => {
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
        }
        catch (error) {
            console.error(`Failed to bootstrap admin ${adminUser.email}:`, error);
        }
    }
    return { success: true };
});
const generateId = () => {
    try {
        return crypto.randomUUID();
    }
    catch (e) {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};
const sanitizeData = (data) => {
    if (!data || typeof data !== 'object')
        return {};
    const sanitized = {};
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
exports.registerPatient = (0, https_1.onCall)(async (request) => {
    console.log("registerPatient called");
    const data = request.data || {};
    const { patientData, photoBase64, clinicId, countryCode } = data;
    if (!patientData || typeof patientData !== 'object') {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid patientData");
    }
    if (!clinicId) {
        throw new https_1.HttpsError("invalid-argument", "Missing clinicId");
    }
    if (!countryCode) {
        throw new https_1.HttpsError("invalid-argument", "Missing countryCode");
    }
    try {
        const patientId = generateId();
        const encounterId = generateId();
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
            }
            catch (error) {
                console.error("Error uploading photo (non-fatal):", error);
            }
        }
        console.log("Creating patient document:", patientId);
        const sanitizedPatientData = sanitizeData(patientData);
        await db.collection("patients").doc(patientId).set({
            ...sanitizedPatientData,
            photo_url: photoUrl || "",
            created_at: new Date()
        });
        console.log("Creating encounter:", encounterId);
        await db.collection("encounters").doc(encounterId).set({
            patient_id: patientId,
            clinic_id: clinicId,
            country_code: countryCode,
            status: 'WAITING_FOR_VITALS',
            created_at: new Date()
        });
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
    }
    catch (error) {
        console.error("registerPatient failed:", error);
        throw new https_1.HttpsError("internal", error.message || "Registration failed");
    }
});
exports.generateBadgeToken = (0, https_1.onCall)(async (request) => {
    console.log("generateBadgeToken called");
    const data = request.data || {};
    const { patientId } = data;
    if (!patientId) {
        throw new https_1.HttpsError("invalid-argument", "Missing patientId");
    }
    try {
        const token = generateId();
        console.log("Creating badge token:", patientId);
        await db.collection("badge_tokens").doc(token).set({
            patient_id: patientId,
            created_at: new Date()
        });
        return { token };
    }
    catch (error) {
        console.error("generateBadgeToken failed:", error);
        throw new https_1.HttpsError("internal", error.message || "Badge token generation failed");
    }
});
//# sourceMappingURL=index.js.map