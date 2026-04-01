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
exports.stockAlerts = exports.getInventoryTemplate = exports.bulkUpload = exports.dispenseMedication = exports.saveConsultation = exports.registerPatient = exports.initClinics = exports.wipeDemoData = exports.wipeTestData = exports.deleteUser = exports.syncUserPermissions = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
let adminCache = null;
const getAdmin = async () => {
    if (!adminCache) {
        adminCache = await Promise.resolve().then(() => __importStar(require("firebase-admin")));
        if (!adminCache.apps.length) {
            adminCache.initializeApp();
        }
    }
    return adminCache;
};
const getDb = async () => {
    const admin = await getAdmin();
    return admin.firestore();
};
const getCrypto = async () => {
    return await Promise.resolve().then(() => __importStar(require("crypto")));
};
const SUPER_ADMIN_EMAILS = [
    'indranil_dutta@haefa.org',
    'ruhul_abid@haefa.org'
];
const REQUISITION_THRESHOLD = 500;
const checkIsGlobalAdmin = (auth) => {
    if (!auth)
        return false;
    const email = auth.token.email?.toLowerCase();
    const role = auth.token.role;
    return SUPER_ADMIN_EMAILS.includes(email) || role === 'global_admin';
};
const generateId = async () => {
    try {
        const crypto = await getCrypto();
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
exports.syncUserPermissions = (0, https_1.onCall)({ region: "us-central1", maxInstances: 10 }, async (request) => {
    if (!checkIsGlobalAdmin(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized: Global Admin required.");
    }
    const { email, role, countryCode, assignedCountries, assignedClinics, isApproved } = request.data;
    if (!email || !role) {
        throw new https_1.HttpsError("invalid-argument", "Missing email or role.");
    }
    try {
        const admin = await getAdmin();
        const db = await getDb();
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
            email, role, countryCode: countryCode || null,
            assignedCountries: assignedCountries || [],
            assignedClinics: assignedClinics || [],
            isApproved: isApproved ?? false,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.deleteUser = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!checkIsGlobalAdmin(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const { uid } = request.data;
    if (!uid)
        throw new https_1.HttpsError("invalid-argument", "Missing UID.");
    if (request.auth.uid === uid) {
        throw new https_1.HttpsError("failed-precondition", "You cannot delete yourself.");
    }
    try {
        const admin = await getAdmin();
        const db = await getDb();
        await admin.auth().deleteUser(uid);
        await db.collection("users").doc(uid).delete();
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.wipeTestData = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
    if (!checkIsGlobalAdmin(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const collections = ["patients", "encounters", "queues_active", "requisitions", "procurement_requests"];
    let totalDeleted = 0;
    const db = await getDb();
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
});
exports.wipeDemoData = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!checkIsGlobalAdmin(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const collectionsToWipe = ["patients", "encounters", "queues_active", "requisitions"];
    const db = await getDb();
    try {
        for (const colName of collectionsToWipe) {
            const snapshot = await db.collection(colName).get();
            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.initClinics = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!checkIsGlobalAdmin(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.registerPatient = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const data = request.data || {};
    const { patientData, photoBase64, clinicId, countryCode } = data;
    if (!patientData || !clinicId || !countryCode) {
        throw new https_1.HttpsError("invalid-argument", "Missing registration data");
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.saveConsultation = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const { encounterId, patientId, clinicId, prescriptions, diagnosis, notes } = request.data;
    const db = await getDb();
    const admin = await getAdmin();
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
});
exports.dispenseMedication = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const { clinicId, medications, encounterId, patientId } = request.data;
    const db = await getDb();
    const admin = await getAdmin();
    return await db.runTransaction(async (transaction) => {
        const results = [];
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
                    if (remaining <= 0)
                        break;
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
});
exports.bulkUpload = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const { clinicId, fileBase64 } = request.data;
    const ExcelJS = await Promise.resolve().then(() => __importStar(require('exceljs')));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
    const worksheet = workbook.getWorksheet(1);
    const db = await getDb();
    const admin = await getAdmin();
    const batch = db.batch();
    worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
            return;
        const medId = row.getCell(1).value?.toString().trim() || "";
        const qty = Number(row.getCell(4).value) || 0;
        const dosage = row.getCell(7).value?.toString().trim() || "N/A";
        if (!medId || medId.toUpperCase().includes('EXAMPLE'))
            return;
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
});
exports.getInventoryTemplate = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const ExcelJS = await Promise.resolve().then(() => __importStar(require('exceljs')));
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
    return { fileBase64: buffer.toString('base64') };
});
exports.stockAlerts = (0, scheduler_1.onSchedule)("every 24 hours", async (event) => {
    const ninetyDays = new Date();
    ninetyDays.setDate(ninetyDays.getDate() + 90);
    const db = await getDb();
    const { Timestamp } = await Promise.resolve().then(() => __importStar(require("firebase-admin/firestore")));
    const clinics = await db.collection("clinics").get();
    for (const doc of clinics.docs) {
        const expiring = await db.collection(`clinics/${doc.id}/inventory`).where("expiry_date", "<=", Timestamp.fromDate(ninetyDays)).where("quantity", ">", 0).get();
        if (!expiring.empty)
            console.log(`Alert: ${expiring.size} expiring batches in ${doc.id}`);
    }
});
//# sourceMappingURL=index.js.map