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
const getSafeMillis = (dateObj) => {
    if (!dateObj)
        return 0;
    if (typeof dateObj.toMillis === 'function')
        return dateObj.toMillis();
    if (typeof dateObj.getTime === 'function')
        return dateObj.getTime();
    const parsed = Date.parse(dateObj);
    return isNaN(parsed) ? (typeof dateObj === 'number' ? dateObj : 0) : parsed;
};
const normalizeDosageKey = (dosageStr) => {
    return (dosageStr || "").toLowerCase().replace(/[^a-z0-9]/g, "");
};
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
    const { email, role, country_id, countryCode, assignedCountries, assignedClinics, isApproved, professional_reg_no, professional_body, designation } = request.data;
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
        try {
            await admin.auth().deleteUser(uid);
        }
        catch (authError) {
            const isUserNotFound = authError.code === 'auth/user-not-found' ||
                (authError.message && authError.message.includes('user-not-found')) ||
                (authError.message && authError.message.includes('no user record corresponding'));
            if (!isUserNotFound) {
                throw authError;
            }
            console.log(`User ${uid} not found in Auth, carrying on with db deletion.`, authError);
        }
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
        created_at: (await (0, utils_1.getAdmin)()).firestore.Timestamp.now()
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
    const { prescriptions = [], diagnosis = "", provisionalDiagnosisMajor = [], provisionalDiagnosisMinor = [], notes = "", treatment_notes = "", followUpDate = null, labInvestigations = [], referrals = [], assessment = {}, isFinalize = true } = data;
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
            const serverTime = admin.firestore.Timestamp.now();
            if (isFinalize) {
                transaction.update(visitRef, (0, utils_1.sanitizeData)({
                    status: 'WAITING_FOR_PHARMACY',
                    encounter_status: 'WAITING_FOR_PHARMACY',
                    current_station: 'pharmacy',
                    diagnosis,
                    provisionalDiagnosisMajor,
                    provisionalDiagnosisMinor,
                    notes,
                    last_updated: serverTime
                }));
            }
            else {
                transaction.update(visitRef, (0, utils_1.sanitizeData)({
                    diagnosis,
                    provisionalDiagnosisMajor,
                    provisionalDiagnosisMinor,
                    notes,
                    last_updated: serverTime
                }));
            }
            const diagRef = db.collection("diagnoses").doc(`${vId}_diag`);
            transaction.set(diagRef, (0, utils_1.sanitizeData)({
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
            const presRef = db.collection("prescriptions").doc(`${vId}_pres`);
            transaction.set(presRef, (0, utils_1.sanitizeData)({
                encounter_id: vId,
                patient_id: pId,
                clinic_id: cId,
                prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
                status: 'PENDING',
                created_at: serverTime
            }), { merge: true });
            if (isFinalize && Array.isArray(prescriptions)) {
                for (const med of prescriptions) {
                    if (med && med.isRequisition) {
                        const reqRef = db.collection("requisitions").doc();
                        transaction.set(reqRef, (0, utils_1.sanitizeData)({
                            clinic_id: cId,
                            medication_name: med.medicationName,
                            dosage: `${med.dosageValue}${med.dosageUnit}`,
                            required_quantity: med.quantity,
                            requested_qty: med.quantity,
                            type: 'DOCTOR_ORDER_NON_STOCK',
                            status: 'PENDING',
                            created_at: serverTime
                        }));
                    }
                }
            }
            if (isFinalize && queueDoc && queueDoc.exists) {
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
    const authUid = request.auth.uid;
    try {
        const db = await (0, utils_1.getDb)();
        const admin = await (0, utils_1.getAdmin)();
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
            logStep("READ", `get user profile ${authUid}`);
            const userProfileSnap = await transaction.get(db.collection("users").doc(authUid));
            const userProfile = userProfileSnap.data() || {};
            let presDocSnap = null;
            if (presRef) {
                logStep("READ", `get ${presRef.path}`);
                presDocSnap = await transaction.get(presRef);
            }
            const inventoryDocs = new Map();
            const initialInventorySnaps = invIds.length > 0 ? await transaction.getAll(...invIds.map(id => db.collection('clinics').doc(cId).collection('inventory').doc(id))) : [];
            for (const snap of initialInventorySnaps) {
                if (!snap.exists)
                    continue;
                const data = snap.data();
                const medId = data.medication_id || data.name;
                const dosage = data.dosage;
                const allBatchesSnap = await db.collection('clinics').doc(cId).collection('inventory')
                    .where('medication_id', '==', medId)
                    .where('dosage', '==', dosage)
                    .get();
                const batches = allBatchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                batches.sort((a, b) => {
                    const dateA = a.expiry_date ? (a.expiry_date.toDate ? a.expiry_date.toDate().getTime() : new Date(a.expiry_date).getTime()) : Infinity;
                    const dateB = b.expiry_date ? (b.expiry_date.toDate ? b.expiry_date.toDate().getTime() : new Date(b.expiry_date).getTime()) : Infinity;
                    return dateA - dateB;
                });
                inventoryDocs.set(`${medId}|${dosage}`, batches);
            }
            let queueDocSnap = null;
            if (qRef) {
                logStep("READ", `get ${qRef.path}`);
                queueDocSnap = await transaction.get(qRef);
            }
            const results = [];
            const requisitionWrites = [];
            let anyShortfallRemaining = false;
            const batchesToUpdate = new Map();
            for (const medication of meds) {
                const { medication_name, medication_dosage, mode, qty, prescribed_qty, substitution, return_on, inventoryId } = medication;
                let actualDeducted = 0;
                let shortfall = Number(prescribed_qty) || Number(qty) || 0;
                const requestedQty = Number(qty) || 0;
                if (mode !== 'OUT_OF_STOCK') {
                    if (!inventoryId) {
                        throw new https_1.HttpsError("invalid-argument", `Medication ${medication_name} is missing inventoryId.`);
                    }
                    const initialSnap = initialInventorySnaps.find((s) => s.id === inventoryId);
                    if (!initialSnap || !initialSnap.exists) {
                        throw new https_1.HttpsError("not-found", `Initial inventory record ${inventoryId} not found.`);
                    }
                    const initialData = initialSnap.data();
                    const medKey = `${initialData.medication_id || initialData.name}|${initialData.dosage}`;
                    const batches = inventoryDocs.get(medKey) || [];
                    let remainingToDeduct = requestedQty;
                    for (const batch of batches) {
                        if (remainingToDeduct <= 0)
                            break;
                        const currentQty = batchesToUpdate.has(batch.id) ? batchesToUpdate.get(batch.id) : Number(batch.quantity) || 0;
                        if (currentQty <= 0)
                            continue;
                        const toTake = Math.min(currentQty, remainingToDeduct);
                        const newQty = currentQty - toTake;
                        batchesToUpdate.set(batch.id, newQty);
                        actualDeducted += toTake;
                        remainingToDeduct -= toTake;
                        const ninetyDaysFromNow = new Date();
                        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
                        const batchExpDate = batch.expiry_date ? (batch.expiry_date.toDate ? batch.expiry_date.toDate() : new Date(batch.expiry_date)) : null;
                        const isExpiringSoon = batchExpDate && batchExpDate < ninetyDaysFromNow;
                        if (newQty < utils_1.REQUISITION_THRESHOLD || isExpiringSoon) {
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
                    const initialSnap = initialInventorySnaps.find((s) => s.id === inventoryId);
                    let totalStockLeft = 0;
                    if (initialSnap?.exists) {
                        const data = initialSnap.data();
                        const medKey = `${data.medication_id || data.name}|${data.dosage}`;
                        const batches = inventoryDocs.get(medKey) || [];
                        totalStockLeft = batches.reduce((sum, b) => sum + (batchesToUpdate.has(b.id) ? batchesToUpdate.get(b.id) : Number(b.quantity) || 0), 0);
                    }
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
                results.push((0, utils_1.sanitizeData)({
                    medication: medication_name,
                    dosage: medication_dosage || '',
                    dispensed: actualDeducted,
                    mode,
                    substitution: substitution || null,
                    return_on: return_on || null,
                    created_at: admin.firestore.Timestamp.now()
                }));
            }
            for (const [id, newQty] of batchesToUpdate.entries()) {
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
                const existingDetails = Array.isArray(presData?.dispensation_details) ? presData.dispensation_details : [];
                const mergedDetails = [...existingDetails, ...results];
                const cleanPresData = (0, utils_1.sanitizeData)({
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
            }
            else {
                const newPresRef = db.collection("prescriptions").doc();
                const cleanPresData = (0, utils_1.sanitizeData)({
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
            const dispEventRef = db.collection("dispensations").doc();
            transaction.set(dispEventRef, (0, utils_1.sanitizeData)({
                encounter_id: vId,
                patient_id: pId,
                clinic_id: cId,
                items: results,
                dispenser_name: userProfile.name || "Unknown Pharmacist",
                dispenser_reg_no: userProfile.professional_reg_no || "N/A",
                dispenser_body: userProfile.professional_body || "PCB",
                created_at: admin.firestore.Timestamp.now()
            }));
            for (const res of results) {
                if (res.dispensed > 0) {
                    const invLogRef = db.collection("inventory_logs").doc();
                    transaction.set(invLogRef, (0, utils_1.sanitizeData)({
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
            const finalStatus = anyShortfallRemaining ? 'PHARMACY_IOU' : 'COMPLETED';
            const cleanVisitData = (0, utils_1.sanitizeData)({
                status: finalStatus,
                last_updated: admin.firestore.Timestamp.now()
            });
            phase = "WRITE";
            logStep("WRITE", `update encounter ${visitRef.path} to ${finalStatus}`);
            transaction.update(visitRef, cleanVisitData);
            if (qRef && queueDocSnap?.exists) {
                phase = "WRITE";
                logStep("WRITE", `update queue ${qRef.path} to ${finalStatus}`);
                if (finalStatus === 'COMPLETED') {
                    const archiveRef = db.collection('queues_archive').doc(qRef.id);
                    const qData = queueDocSnap.data();
                    transaction.set(archiveRef, (0, utils_1.sanitizeData)({
                        ...qData,
                        status: finalStatus,
                        station: 'completed',
                        updated_at: admin.firestore.Timestamp.now()
                    }));
                    transaction.delete(qRef);
                }
                else {
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
                    transaction.update(qRef, (0, utils_1.sanitizeData)({
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
    const { clinicId, fileBase64, userName } = request.data;
    if (!clinicId || !fileBase64) {
        throw new https_1.HttpsError("invalid-argument", "Missing clinicId or file data.");
    }
    const authUid = request.auth?.uid || "Anonymous";
    let ExcelJSModule;
    try {
        ExcelJSModule = await Promise.resolve().then(() => __importStar(require('exceljs')));
    }
    catch (e) {
        throw new https_1.HttpsError("internal", "Could not load exceljs");
    }
    const Workbook = ExcelJSModule.Workbook || ExcelJSModule.default?.Workbook;
    if (!Workbook) {
        throw new https_1.HttpsError("internal", "ExcelJS.Workbook is undefined");
    }
    const workbook = new Workbook();
    try {
        await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
    }
    catch (err) {
        console.error("load error", err);
        throw new https_1.HttpsError("invalid-argument", "Invalid Excel file format.");
    }
    const worksheet = workbook.getWorksheet(1);
    const db = await (0, utils_1.getDb)();
    const admin = await (0, utils_1.getAdmin)();
    const batch = db.batch();
    const incomingStock = new Map();
    let opCount = 0;
    worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
            return;
        const medId = row.getCell(1).value?.toString().trim() || "";
        if (!medId || medId.toUpperCase().includes('EXAMPLE') || medId.toLowerCase().includes('save completed file'))
            return;
        const batchId = row.getCell(2).value?.toString().trim() || "";
        let expiry_date = null;
        const expiryVal = row.getCell(3).value;
        if (expiryVal instanceof Date) {
            expiry_date = admin.firestore.Timestamp.fromDate(expiryVal);
        }
        else if (typeof expiryVal === 'string') {
            const d = new Date(expiryVal);
            if (!isNaN(d.getTime())) {
                expiry_date = admin.firestore.Timestamp.fromDate(d);
            }
        }
        const qty = Number(row.getCell(4).value) || 0;
        const base_unit = row.getCell(5).value?.toString().trim() || "";
        const package_unit = row.getCell(6).value?.toString().trim() || "";
        let dosage = row.getCell(7).value?.toString().trim() || "";
        const dosage_unit = row.getCell(8).value?.toString().trim() || "";
        if (dosage && dosage_unit) {
            dosage = `${dosage} ${dosage_unit}`;
        }
        else if (!dosage && dosage_unit) {
            dosage = dosage_unit;
        }
        else if (!dosage) {
            dosage = "N/A";
        }
        const medLower = medId.toLowerCase().trim();
        const dosageLower = normalizeDosageKey(dosage);
        const stockKey = `${medLower}|${dosageLower}`;
        incomingStock.set(stockKey, (incomingStock.get(stockKey) || 0) + qty);
        const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
        const payload = {
            medication_id: medId,
            med_id_lower: medLower,
            dosage,
            quantity: qty,
            created_at: admin.firestore.Timestamp.now(),
            created_by_name: userName || "Pharmacist"
        };
        if (batchId)
            payload.batch_id = batchId;
        if (expiry_date)
            payload.expiry_date = expiry_date;
        if (base_unit)
            payload.base_unit = base_unit;
        if (package_unit)
            payload.package_unit = package_unit;
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
    const openReqsSnap = await db.collection("requisitions")
        .where("clinic_id", "==", clinicId)
        .get();
    const openReqs = openReqsSnap.docs
        .map(d => ({ docSnap: d, data: d.data() }))
        .filter(({ data }) => data && data.status !== 'FULFILLED' && data.status !== 'CANCELLED')
        .sort((a, b) => getSafeMillis(a.data?.created_at) - getSafeMillis(b.data?.created_at));
    for (const { docSnap, data } of openReqs) {
        const medLower = (data.medication_name || "").toLowerCase().trim();
        const rawDosage = data.medication_dosage || data.dosage || "N/A";
        const dosageLower = normalizeDosageKey(rawDosage);
        let matchedKey = `${medLower}|${dosageLower}`;
        if (!incomingStock.has(matchedKey)) {
            const keys = Array.from(incomingStock.keys());
            const fuzzyKey = keys.find(k => k.startsWith(`${medLower}|`));
            if (fuzzyKey) {
                matchedKey = fuzzyKey;
            }
        }
        if (incomingStock.has(matchedKey)) {
            let remainingStock = incomingStock.get(matchedKey);
            let reqQty = data.required_quantity || data.requested_qty || 0;
            if (remainingStock > 0 && reqQty > 0 && opCount < 500) {
                let fulfilled = Math.min(remainingStock, reqQty);
                let newReqQty = reqQty - fulfilled;
                let newStock = remainingStock - fulfilled;
                incomingStock.set(matchedKey, newStock);
                batch.update(docSnap.ref, {
                    required_quantity: newReqQty,
                    status: newReqQty <= 0 ? 'FULFILLED' : data.status,
                    updated_at: admin.firestore.Timestamp.now()
                });
                opCount++;
            }
            else if (remainingStock > 0 && data.type === 'LOW_STOCK_ALERT' && opCount < 500) {
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
    }
    catch (batchErr) {
        console.error("Batch error", batchErr);
        throw new https_1.HttpsError("internal", "Failed to commit batch updates.");
    }
    return { success: true };
});
exports.getInventoryTemplate = (0, https_1.onCall)(async (request) => {
    let ExcelJSModule;
    try {
        ExcelJSModule = await Promise.resolve().then(() => __importStar(require('exceljs')));
    }
    catch (e) {
        throw new https_1.HttpsError("internal", "Could not load exceljs");
    }
    const Workbook = ExcelJSModule.Workbook || ExcelJSModule.default?.Workbook;
    if (!Workbook) {
        throw new https_1.HttpsError("internal", "ExcelJS.Workbook is undefined");
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
    sheet.getColumn('expiry').numFmt = 'dd/mm/yyyy';
    sheet.addRow({
        name: 'Save completed file in format - Country-Clinic-Date.xlsx    Example: Bangladesh-Dhaka-June 22nd.xlsx'
    });
    sheet.mergeCells('A2:H2');
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
    [sheet.getRow(2), sheet.getRow(3), sheet.getRow(4)].forEach(row => {
        row.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFC000' }
            };
            cell.font = { bold: true };
        });
    });
    const guidanceCell = sheet.getCell('A2');
    guidanceCell.font = {
        bold: true,
        color: { argb: 'FFFF0000' }
    };
    for (let i = 5; i <= 1000; i++) {
        sheet.getCell(`H${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"mg,g,mcg,ml,IU"']
        };
        sheet.getCell(`E${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Tablet,Capsule,Bottle"']
        };
        sheet.getCell(`F${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Box,Bottle,Carton,Pack,Strip,Tube,Vial,Case,Piece,Sachet"']
        };
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
        const comorbidityMap = {};
        const medVolumes = {};
        const referralMap = {};
        const patientIds = [...new Set(encountersSnap.docs.map(d => d.data().patient_id))].filter(Boolean);
        const patientDataMap = {};
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
            const t = encData.triage_level || 'standard';
            triageCounts[t] = (triageCounts[t] || 0) + 1;
            if (encData.diagnosis) {
                diseaseMap[encData.diagnosis] = (diseaseMap[encData.diagnosis] || 0) + 1;
            }
            const majors = encData.provisionalDiagnosisMajor || (encData.diagnosis ? [encData.diagnosis] : []);
            const minors = encData.provisionalDiagnosisMinor || [];
            if (majors.length > 0 && minors.length > 0) {
                const patient = patientDataMap[encData.patient_id] || {};
                let ageGroup = "Unknown";
                if (patient.age_years !== undefined) {
                    if (patient.age_years < 18)
                        ageGroup = "0-17";
                    else if (patient.age_years < 40)
                        ageGroup = "18-39";
                    else if (patient.age_years < 60)
                        ageGroup = "40-59";
                    else
                        ageGroup = "60+";
                }
                const sex = patient.gender === 'male' ? 'Male' : (patient.gender === 'female' ? 'Female' : 'Unknown');
                const nationality = patient.is_fdmn ? 'Rohingya' : 'Host Community';
                for (const major of majors) {
                    if (!comorbidityMap[major]) {
                        comorbidityMap[major] = { _total: {} };
                    }
                    for (const minor of minors) {
                        comorbidityMap[major]._total[minor] = (comorbidityMap[major]._total[minor] || 0) + 1;
                        if (!comorbidityMap[major][ageGroup])
                            comorbidityMap[major][ageGroup] = {};
                        comorbidityMap[major][ageGroup][minor] = (comorbidityMap[major][ageGroup][minor] || 0) + 1;
                        if (!comorbidityMap[major][sex])
                            comorbidityMap[major][sex] = {};
                        comorbidityMap[major][sex][minor] = (comorbidityMap[major][sex][minor] || 0) + 1;
                        if (!comorbidityMap[major][nationality])
                            comorbidityMap[major][nationality] = {};
                        comorbidityMap[major][nationality][minor] = (comorbidityMap[major][nationality][minor] || 0) + 1;
                    }
                }
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
exports.triggerAggregation = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !(0, utils_1.checkIsGlobalAdmin)(request.auth)) {
        throw new https_1.HttpsError("permission-denied", "Unauthorized.");
    }
    return { success: true, message: "Daily aggregation triggered successfully." };
});
//# sourceMappingURL=index.js.map