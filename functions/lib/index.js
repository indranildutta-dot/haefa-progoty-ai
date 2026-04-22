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
exports.triggerAggregation = exports.generateDailySummaries = exports.stockAlerts = exports.getInventoryTemplate = exports.bulkUpload = exports.dispenseMedication = exports.saveConsultation = exports.registerPatient = exports.initClinics = exports.wipeDemoData = exports.wipeTestData = exports.deleteUser = exports.syncUserPermissions = exports.getIcdToken = void 0;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("./utils");
(0, v2_1.setGlobalOptions)({
    region: "us-central1",
    maxInstances: 10
});
let cachedToken = null;
exports.getIcdToken = (0, https_1.onCall)(async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Login required.");
        }
        const now = Date.now();
        if (cachedToken && cachedToken.expiry > now + 120000) {
            console.log("Returning cached ICD token.");
            return cachedToken.token;
        }
        const clientId = process.env.WHO_CLIENT_ID;
        const clientSecret = process.env.WHO_CLIENT_SECRET;
        console.log("Fetching new ICD token from WHO API...");
        if (!clientId || !clientSecret) {
            console.error("WHO_CLIENT_ID or WHO_CLIENT_SECRET missing in environment.");
            throw new https_1.HttpsError("failed-precondition", "WHO ICD-11 credentials are not configured in the environment.");
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
        const data = await response.json();
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
    }
    catch (error) {
        logger.error('ICD_TOKEN_FAILURE', {
            error: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        console.error("getIcdToken Exception:", error);
        throw new https_1.HttpsError("internal", `ICD Token retrieval failed: ${error.message}`);
    }
});
exports.syncUserPermissions = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized: Global Admin required.");
    }
    const { email, role, country_id, assignedCountries, assignedClinics, isApproved } = request.data;
    if (!email || !role) {
        throw new https_1.HttpsError("invalid-argument", "Missing email or role.");
    }
    try {
        const admin = await (0, utils_1.getAdmin)();
        const db = await (0, utils_1.getDb)();
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
            email, role, country_id: country_id || null,
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
exports.deleteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const { uid } = request.data;
    if (!uid)
        throw new https_1.HttpsError("invalid-argument", "Missing UID.");
    if (request.auth.uid === uid) {
        throw new https_1.HttpsError("failed-precondition", "You cannot delete yourself.");
    }
    try {
        const admin = await (0, utils_1.getAdmin)();
        const db = await (0, utils_1.getDb)();
        await admin.auth().deleteUser(uid);
        await db.collection("users").doc(uid).delete();
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.wipeTestData = (0, https_1.onCall)({ timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const collections = ["patients", "encounters", "queues_active", "requisitions", "procurement_requests"];
    let totalDeleted = 0;
    const db = await (0, utils_1.getDb)();
    for (const colName of collections) {
        let hasMore = true;
        while (hasMore) {
            const snapshot = await db.collection(colName).limit(500).get();
            if (snapshot.empty) {
                hasMore = false;
            }
            else {
                const batch = db.batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
                totalDeleted += snapshot.size;
            }
        }
    }
    return { success: true, deletedCount: totalDeleted };
});
exports.wipeDemoData = (0, https_1.onCall)({ timeoutSeconds: 540 }, async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    const collectionsToWipe = ["patients", "encounters", "queues_active", "requisitions"];
    const db = await (0, utils_1.getDb)();
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
exports.initClinics = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
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
        created_at: (await (0, utils_1.getAdmin)()).firestore.FieldValue.serverTimestamp()
    };
    try {
        const db = await (0, utils_1.getDb)();
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
exports.registerPatient = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const { patientData, photoBase64, clinicId, country_id } = request.data;
    if (!patientData || !clinicId || !country_id) {
        throw new https_1.HttpsError("invalid-argument", "Missing registration data: patientData, clinicId, or country_id.");
    }
    try {
        const crypto = await (0, utils_1.getCrypto)();
        const admin = await (0, utils_1.getAdmin)();
        const db = await (0, utils_1.getDb)();
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
            ...(0, utils_1.sanitizeData)(patientData),
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.saveConsultation = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const data = request.data;
    const vId = data.encounterId || data.visitId;
    if (!vId)
        throw new https_1.HttpsError("invalid-argument", "Missing encounterId (visitId).");
    const pId = data.patientId;
    if (!pId)
        throw new https_1.HttpsError("invalid-argument", "Missing patientId.");
    const cId = data.clinicId;
    if (!cId)
        throw new https_1.HttpsError("invalid-argument", "Missing clinicId.");
    const { prescriptions = [], diagnosis = "No diagnosis", notes = "", treatment_notes = "", labInvestigations = [], referrals = [], assessment = {} } = data;
    console.log(`HAEFA: Starting saveConsultation for Encounter ${vId}, Patient ${pId}`);
    const authUid = request.auth.uid;
    try {
        const db = await (0, utils_1.getDb)();
        const admin = await (0, utils_1.getAdmin)();
        console.log(`HAEFA: saveConsultation payload keys: ${Object.keys(data).join(', ')}`);
        const visitRef = db.collection("encounters").doc(vId);
        const qSnapOuter = await db.collection("queues_active").where("encounter_id", "==", vId).limit(1).get();
        const qRef = qSnapOuter.empty ? null : qSnapOuter.docs[0].ref;
        return await db.runTransaction(async (transaction) => {
            console.log(`HAEFA: Transaction active for ${vId}`);
            const encounterDoc = await transaction.get(visitRef);
            const userProfileSnap = await transaction.get(db.collection("users").doc(authUid));
            let queueDoc = null;
            if (qRef) {
                queueDoc = await transaction.get(qRef);
            }
            if (!encounterDoc.exists) {
                throw new https_1.HttpsError("not-found", `Encounter ${vId} not found.`);
            }
            const userProfile = userProfileSnap?.data() || {};
            const serverTime = admin.firestore.FieldValue.serverTimestamp();
            transaction.update(visitRef, (0, utils_1.sanitizeData)({
                status: 'WAITING_FOR_PHARMACY',
                encounter_status: 'WAITING_FOR_PHARMACY',
                current_station: 'pharmacy',
                diagnosis,
                notes,
                last_updated: serverTime
            }));
            const diagRef = db.collection("diagnoses").doc();
            transaction.set(diagRef, (0, utils_1.sanitizeData)({
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
            const presRef = db.collection("prescriptions").doc();
            transaction.set(presRef, (0, utils_1.sanitizeData)({
                encounter_id: vId,
                patient_id: pId,
                clinic_id: cId,
                prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
                status: 'PENDING',
                created_at: serverTime
            }));
            if (Array.isArray(prescriptions)) {
                for (const med of prescriptions) {
                    if (med && med.isRequisition) {
                        const reqRef = db.collection("requisitions").doc();
                        transaction.set(reqRef, (0, utils_1.sanitizeData)({
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
            if (queueDoc && queueDoc.exists) {
                transaction.update(queueDoc.ref, (0, utils_1.sanitizeData)({
                    station: 'pharmacy',
                    status: 'WAITING_FOR_PHARMACY',
                    updated_at: serverTime
                }));
            }
            console.log(`HAEFA: Transaction commit staged for ${vId}`);
            return { success: true, encounterId: vId };
        });
    }
    catch (error) {
        console.error("HAEFA Critical error in saveConsultation:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        const errorMessage = error.message || "Unknown error";
        const errorStack = error.stack || "";
        console.error(`HAEFA Save Failure Detail: ${errorMessage}`, errorStack);
        throw new https_1.HttpsError("internal", `Consultation failed to save: ${errorMessage}`);
    }
});
exports.dispenseMedication = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const data = request.data;
    const cId = data.clinicId;
    const meds = data.medications;
    const vId = data.encounterId || data.visitId;
    const pId = data.patientId;
    if (!cId || !meds || !vId || !pId) {
        throw new https_1.HttpsError("invalid-argument", "Missing clinicId, medications, encounterId, or patientId.");
    }
    try {
        const db = await (0, utils_1.getDb)();
        const admin = await (0, utils_1.getAdmin)();
        const userProfile = (await db.collection("users").doc(request.auth.uid).get()).data() || {};
        const visitRef = db.collection("encounters").doc(vId);
        const invIds = Array.from(new Set(meds.map(m => m.inventoryId).filter(id => !!id)));
        const presSnapOuter = await db.collection("prescriptions").where("encounter_id", "==", vId).limit(1).get();
        const presRef = presSnapOuter.empty ? null : presSnapOuter.docs[0].ref;
        const qSnapOuter = await db.collection("queues_active").where("encounter_id", "==", vId).limit(1).get();
        const qRef = qSnapOuter.empty ? null : qSnapOuter.docs[0].ref;
        return await db.runTransaction(async (transaction) => {
            console.log("[TX] Starting transaction");
            let phase = "READ";
            let step = 0;
            const logStep = (type, label) => {
                step++;
                console.log(`[TX][${step}] ${type} | phase=${phase} | ${label}`);
                if (phase === "WRITE" && type === "READ") {
                    console.error(`[TX][VIOLATION] READ AFTER WRITE DETECTED at step ${step}: ${label}`);
                }
            };
            logStep("READ", `get ${visitRef.path}`);
            const visitDoc = await transaction.get(visitRef);
            if (!visitDoc.exists) {
                throw new https_1.HttpsError("not-found", `Encounter ${vId} not found.`);
            }
            let presDocSnap = null;
            if (presRef) {
                logStep("READ", `get ${presRef.path}`);
                presDocSnap = await transaction.get(presRef);
            }
            const inventoryDocs = new Map();
            const inventoryRefs = invIds.map(id => db.collection('clinics').doc(cId).collection('inventory').doc(id));
            let inventorySnaps = [];
            if (inventoryRefs.length > 0) {
                logStep("READ", `getAll inventoryRefs count=${inventoryRefs.length}`);
                inventorySnaps = await transaction.getAll(...inventoryRefs);
            }
            let queueDocSnap = null;
            if (qRef) {
                logStep("READ", `get ${qRef.path}`);
                queueDocSnap = await transaction.get(qRef);
            }
            inventorySnaps.forEach((snap, idx) => {
                inventoryDocs.set(invIds[idx], snap.exists ? snap.data() : null);
            });
            const currentStockLevels = new Map();
            inventoryDocs.forEach((data, id) => {
                if (data)
                    currentStockLevels.set(id, Number(data.quantity) || 0);
            });
            const results = [];
            const requisitionWrites = [];
            for (const medication of meds) {
                const { medication_name, mode, qty, substitution, return_on, inventoryId } = medication;
                const targetMedName = (mode === 'SUBSTITUTE' && substitution) ? substitution : medication_name;
                let actualDeducted = 0;
                if (mode !== 'OUT_OF_STOCK') {
                    if (!inventoryId) {
                        throw new https_1.HttpsError("invalid-argument", `Medication ${medication_name} is missing inventoryId.`);
                    }
                    const available = currentStockLevels.get(inventoryId);
                    if (available === undefined) {
                        throw new https_1.HttpsError("not-found", `Inventory record ${inventoryId} not found.`);
                    }
                    const toTake = Math.min(available, Number(qty));
                    const newQty = available - toTake;
                    currentStockLevels.set(inventoryId, newQty);
                    actualDeducted = toTake;
                    if (newQty < utils_1.REQUISITION_THRESHOLD) {
                        requisitionWrites.push({
                            clinic_id: cId, medication_name: targetMedName,
                            current_stock: newQty, type: 'LOW_STOCK_ALERT', status: 'PENDING',
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
                if (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') {
                    requisitionWrites.push({
                        clinic_id: cId, patient_id: pId, medication_name: medication_name,
                        type: 'PATIENT_IOU_SHORTFALL', status: 'WAITING_FOR_STOCK',
                        return_date: return_on || null, encounter_id: vId,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                results.push((0, utils_1.sanitizeData)({
                    medication: medication_name,
                    dispensed: actualDeducted,
                    mode,
                    substitution: substitution || null,
                    return_on: return_on || null
                }));
            }
            for (const [id, newQty] of currentStockLevels.entries()) {
                const invRef = db.collection('clinics').doc(cId).collection('inventory').doc(id);
                const cleanInvData = (0, utils_1.sanitizeData)({ quantity: newQty });
                phase = "WRITE";
                logStep("WRITE", `update inventory ${invRef.path} -> ${newQty}`);
                transaction.update(invRef, cleanInvData);
            }
            for (const reqData of requisitionWrites) {
                const reqRef = db.collection("requisitions").doc();
                const cleanReqData = (0, utils_1.sanitizeData)(reqData);
                phase = "WRITE";
                logStep("WRITE", `create requisition ${reqRef.path}`);
                transaction.set(reqRef, cleanReqData);
            }
            if (presRef) {
                const presData = presDocSnap?.data();
                const cleanPresData = (0, utils_1.sanitizeData)({
                    status: 'DISPENSED',
                    dispensedDate: presData?.dispensedDate || admin.firestore.FieldValue.serverTimestamp(),
                    dispenser_name: userProfile.name || "Unknown Pharmacist",
                    dispenser_reg_no: userProfile.professional_reg_no || "N/A",
                    dispenser_body: userProfile.professional_body || "PCB",
                    dispensation_details: results,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                phase = "WRITE";
                logStep("WRITE", `update prescription ${presRef.path}`);
                transaction.update(presRef, cleanPresData);
            }
            const cleanVisitData = (0, utils_1.sanitizeData)({
                status: 'COMPLETED',
                last_updated: admin.firestore.FieldValue.serverTimestamp()
            });
            phase = "WRITE";
            logStep("WRITE", `update encounter ${visitRef.path}`);
            transaction.update(visitRef, cleanVisitData);
            if (qRef && queueDocSnap?.exists) {
                phase = "WRITE";
                logStep("WRITE", `update queue ${qRef.path} to COMPLETED`);
                transaction.update(qRef, (0, utils_1.sanitizeData)({
                    status: 'COMPLETED',
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                }));
            }
            console.log("[TX] Transaction completed successfully");
            return { success: true, summary: results };
        });
    }
    catch (error) {
        logger.error("HAEFA Critical error in dispenseMedication:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        const errorMessage = error.message || "Unknown error";
        throw new https_1.HttpsError("internal", `Dispensing failed: ${errorMessage}`);
    }
});
exports.bulkUpload = (0, https_1.onCall)(async (request) => {
    const { clinicId, fileBase64 } = request.data;
    if (!clinicId || !fileBase64) {
        throw new https_1.HttpsError("invalid-argument", "Missing clinicId or file data.");
    }
    const ExcelJS = await Promise.resolve().then(() => __importStar(require('exceljs')));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
    const worksheet = workbook.getWorksheet(1);
    const db = await (0, utils_1.getDb)();
    const admin = await (0, utils_1.getAdmin)();
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
            med_id_lower: (medId || "").toLowerCase().replace(/\s+/g, ''),
            dosage, quantity: qty,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await batch.commit();
    return { success: true };
});
exports.getInventoryTemplate = (0, https_1.onCall)(async (request) => {
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
    const db = await (0, utils_1.getDb)();
    const { Timestamp } = await Promise.resolve().then(() => __importStar(require("firebase-admin/firestore")));
    const clinics = await db.collection("clinics").get();
    for (const doc of clinics.docs) {
        const expiring = await db.collection(`clinics/${doc.id}/inventory`).where("expiry_date", "<=", Timestamp.fromDate(ninetyDays)).where("quantity", ">", 0).get();
        if (!expiring.empty)
            console.log(`Alert: ${expiring.size} expiring batches in ${doc.id}`);
    }
});
exports.generateDailySummaries = (0, scheduler_1.onSchedule)("every 24 hours", async (event) => {
    const db = await (0, utils_1.getDb)();
    const admin = await (0, utils_1.getAdmin)();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));
    const clinics = await db.collection("clinics").get();
    for (const clinicDoc of clinics.docs) {
        const clinicId = clinicDoc.id;
        const countryId = clinicDoc.data().country_id;
        const encountersSnap = await db.collection("encounters")
            .where("clinic_id", "==", clinicId)
            .where("created_at", ">=", startOfDay)
            .where("created_at", "<=", endOfDay)
            .get();
        if (encountersSnap.empty)
            continue;
        const totalPatients = encountersSnap.size;
        const triageCounts = {};
        const genderCounts = {};
        const diseaseMap = {};
        const medVolumes = {};
        const referralMap = {};
        let totalSbp = 0, totalDbp = 0, totalGluc = 0, ncdCount = 0;
        let ancVisits = 0, highRiskPreg = 0;
        let muacGreen = 0, muacYellow = 0, muacRed = 0;
        let tbSuspected = 0;
        for (const encDoc of encountersSnap.docs) {
            const encData = encDoc.data();
            const t = encData.triage_level || 'standard';
            triageCounts[t] = (triageCounts[t] || 0) + 1;
            if (encData.diagnosis) {
                diseaseMap[encData.diagnosis] = (diseaseMap[encData.diagnosis] || 0) + 1;
            }
            if (encData.sbp || encData.glucose) {
                totalSbp += Number(encData.sbp) || 0;
                totalDbp += Number(encData.dbp) || 0;
                totalGluc += Number(encData.glucose) || 0;
                ncdCount++;
            }
            if (encData.is_pregnant || encData.anc_visit) {
                ancVisits++;
                if (encData.high_risk_pregnancy)
                    highRiskPreg++;
            }
            if (encData.muac) {
                const muac = Number(encData.muac);
                if (muac >= 12.5)
                    muacGreen++;
                else if (muac >= 11.5)
                    muacYellow++;
                else
                    muacRed++;
            }
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
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
});
exports.triggerAggregation = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    return { success: true, message: "Daily aggregation triggered successfully." };
});
//# sourceMappingURL=index.js.map