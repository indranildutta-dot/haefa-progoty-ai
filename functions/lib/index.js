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
exports.stockAlerts = exports.bulkUpload = exports.dispenseMedication = exports.getInventoryTemplate = exports.generateBadgeToken = exports.registerPatient = exports.bootstrapAdmins = exports.migrateUsers = exports.syncUserPermissions = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
const ExcelJS = __importStar(require("exceljs"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const generateId = () => {
    try {
        return crypto.randomUUID();
    }
    catch (e) {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};
const parseClinicalDate = (input) => {
    if (!input)
        return null;
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
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
exports.syncUserPermissions = (0, https_1.onCall)({ region: "us-central1", maxInstances: 10 }, async (request) => {
    if (!request.auth || request.auth.token.role !== 'global_admin') {
        throw new https_1.HttpsError("permission-denied", "Only global admins can execute this function.");
    }
    const { email, role, countryCode, assignedCountries, assignedClinics, isApproved } = request.data;
    if (!email || !role) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields: email or role.");
    }
    try {
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                userRecord = await admin.auth().createUser({ email });
            }
            else {
                throw error;
            }
        }
        const uid = userRecord.uid;
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
    }
    catch (error) {
        console.error("Error syncing permissions:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to sync permissions.");
    }
});
exports.migrateUsers = (0, https_1.onCall)({ region: "us-central1", maxInstances: 10 }, async (request) => {
    if (!request.auth || request.auth.token.role !== 'global_admin') {
        throw new https_1.HttpsError("permission-denied", "Only global admins can execute this function.");
    }
    try {
        const usersSnapshot = await db.collection("users").get();
        const batch = db.batch();
        let count = 0;
        usersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.isApproved !== undefined)
                return;
            batch.update(doc.ref, {
                countryCode: data.countryId || null,
                assignedCountries: [],
                assignedClinics: [],
                isApproved: false,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });
        if (count > 0)
            await batch.commit();
        return { success: true, message: `Migrated ${count} users.` };
    }
    catch (error) {
        console.error("Error migrating users:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to migrate users.");
    }
});
exports.bootstrapAdmins = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
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
exports.registerPatient = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const data = request.data || {};
    const { patientData, photoBase64, clinicId, countryCode } = data;
    if (!patientData || typeof patientData !== 'object' || !clinicId || !countryCode) {
        throw new https_1.HttpsError("invalid-argument", "Missing required registration data");
    }
    try {
        const patientId = generateId();
        const encounterId = generateId();
        let photoUrl = "";
        if (photoBase64 && typeof photoBase64 === 'string' && photoBase64.includes(",")) {
            try {
                const bucket = admin.storage().bucket();
                const file = bucket.file(`patient_photos/${patientId}/photo.jpg`);
                const base64Data = photoBase64.split(",")[1];
                if (base64Data) {
                    const buffer = Buffer.from(base64Data, "base64");
                    await file.save(buffer, { contentType: "image/jpeg" });
                    const signedUrls = await file.getSignedUrl({ action: "read", expires: "03-01-2500" });
                    photoUrl = signedUrls[0];
                }
            }
            catch (error) {
                console.error("Photo upload error:", error);
            }
        }
        const sanitizedPatientData = sanitizeData(patientData);
        await db.collection("patients").doc(patientId).set({
            ...sanitizedPatientData,
            photo_url: photoUrl || "",
            created_at: new Date()
        });
        await db.collection("encounters").doc(encounterId).set({
            patient_id: patientId,
            clinic_id: clinicId,
            country_code: countryCode,
            status: 'WAITING_FOR_VITALS',
            created_at: new Date()
        });
        const fullName = `${patientData.given_name || ''} ${patientData.family_name || ''}`.trim() || 'Unknown Patient';
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
        return { patientId, encounterId, photoUrl };
    }
    catch (error) {
        console.error("registerPatient failed:", error);
        throw new https_1.HttpsError("internal", error.message || "Registration failed");
    }
});
exports.generateBadgeToken = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const { patientId } = request.data;
    if (!patientId)
        throw new https_1.HttpsError("invalid-argument", "Missing patientId");
    try {
        const token = generateId();
        await db.collection("badge_tokens").doc(token).set({
            patient_id: patientId,
            created_at: new Date()
        });
        return { token };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.getInventoryTemplate = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
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
    const examples = [
        ['Tylenol (EXAMPLE)', 'BATCH-001', '2026-12-31', 100, 'tablets', 'box', '500mg'],
        ['Amoxicillin (EXAMPLE)', 'B-999', '2025-06-15', 50, 'capsules', 'bottle', '250mg']
    ];
    examples.forEach(data => {
        const row = sheet.addRow(data);
        row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA500' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return { fileBase64: Buffer.from(buffer).toString('base64') };
});
exports.dispenseMedication = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const { clinicId, medications, encounterId } = request.data;
    if (!clinicId || !medications || !encounterId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    return await db.runTransaction(async (transaction) => {
        try {
            for (const med of medications) {
                const medIdLower = med.medication_id.toString().toLowerCase().replace(/\s+/g, '');
                const dosageNormalized = med.dosage.toString().toLowerCase().replace(/\s+/g, '');
                const inventoryRef = db.collection(`clinics/${clinicId}/inventory`);
                const q = inventoryRef
                    .where("med_id_lower", "==", medIdLower)
                    .where("dosage_normalized", "==", dosageNormalized)
                    .orderBy("expiry_date", "asc");
                const snapshot = await transaction.get(q);
                if (snapshot.empty) {
                    throw new https_1.HttpsError("failed-precondition", `Stock not found for ${med.medication_id} ${med.dosage}`);
                }
                let remainingToDispense = med.quantity;
                for (const doc of snapshot.docs) {
                    if (remainingToDispense <= 0)
                        break;
                    const batch = doc.data();
                    const available = batch.quantity;
                    if (available <= 0)
                        continue;
                    const toTake = Math.min(available, remainingToDispense);
                    transaction.update(doc.ref, { quantity: available - toTake });
                    remainingToDispense -= toTake;
                    const logRef = db.collection("inventory_logs").doc();
                    transaction.set(logRef, {
                        clinic_id: clinicId,
                        medication_id: med.medication_id,
                        dosage: dosageNormalized,
                        batch_id: batch.batch_id,
                        type: 'dispense',
                        quantity: toTake,
                        user_id: request.auth?.uid,
                        encounter_id: encounterId,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                if (remainingToDispense > 0) {
                    throw new https_1.HttpsError("failed-precondition", `Insufficient stock for ${med.medication_id}`);
                }
            }
            const encounterRef = db.collection("encounters").doc(encounterId);
            transaction.update(encounterRef, { status: 'COMPLETED' });
            return { success: true };
        }
        catch (error) {
            console.error("Dispensing failed:", error);
            throw error;
        }
    });
});
exports.bulkUpload = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const { clinicId, fileBase64 } = request.data;
    if (!clinicId || !fileBase64) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet)
        throw new https_1.HttpsError("internal", "Failed to load worksheet");
    const batch = db.batch();
    worksheet.eachRow((row, rowNumber) => {
        const medication_id = row.getCell(1).value?.toString().trim() || "";
        const dosage = row.getCell(7).value?.toString().trim() || "N/A";
        const upperName = medication_id.toUpperCase();
        if (!medication_id || upperName === 'MEDICATION_ID' || upperName.includes('EXAMPLE'))
            return;
        const parsedDate = parseClinicalDate(row.getCell(3).value);
        if (!parsedDate)
            return;
        const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
        batch.set(docRef, {
            medication_id: medication_id,
            med_id_lower: medication_id.toLowerCase().replace(/\s+/g, ''),
            dosage: dosage,
            dosage_normalized: dosage.toLowerCase().replace(/\s+/g, ''),
            batch_id: row.getCell(2).value?.toString().trim() || "N/A",
            expiry_date: firestore_1.Timestamp.fromDate(parsedDate),
            quantity: Number(row.getCell(4).value) || 0,
            base_unit: row.getCell(5).value?.toString().trim() || "",
            package_unit: row.getCell(6).value?.toString().trim() || "",
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await batch.commit();
    return { success: true };
});
exports.stockAlerts = (0, scheduler_1.onSchedule)("every 24 hours", async (event) => {
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const clinicsSnapshot = await db.collection("clinics").get();
    for (const clinicDoc of clinicsSnapshot.docs) {
        const clinicId = clinicDoc.id;
        const inventorySnapshot = await db.collection(`clinics/${clinicId}/inventory`)
            .where("expiry_date", "<=", firestore_1.Timestamp.fromDate(ninetyDaysFromNow))
            .where("quantity", ">", 0)
            .get();
        if (!inventorySnapshot.empty) {
            console.log(`Alert: ${inventorySnapshot.size} expiring batches in clinic ${clinicId}`);
        }
    }
});
//# sourceMappingURL=index.js.map