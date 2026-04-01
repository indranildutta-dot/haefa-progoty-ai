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
exports.sanitizeData = exports.generateId = exports.checkIsGlobalAdmin = exports.REQUISITION_THRESHOLD = exports.SUPER_ADMIN_EMAILS = exports.getCrypto = exports.getDb = exports.getAdmin = void 0;
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
exports.getAdmin = getAdmin;
const getDb = async () => {
    const admin = await (0, exports.getAdmin)();
    return admin.firestore();
};
exports.getDb = getDb;
const getCrypto = async () => {
    return await Promise.resolve().then(() => __importStar(require("crypto")));
};
exports.getCrypto = getCrypto;
exports.SUPER_ADMIN_EMAILS = [
    'indranil_dutta@haefa.org',
    'ruhul_abid@haefa.org'
];
exports.REQUISITION_THRESHOLD = 500;
const checkIsGlobalAdmin = (auth) => {
    if (!auth)
        return false;
    const email = auth.token.email?.toLowerCase();
    const role = auth.token.role;
    return exports.SUPER_ADMIN_EMAILS.includes(email) || role === 'global_admin';
};
exports.checkIsGlobalAdmin = checkIsGlobalAdmin;
const generateId = async () => {
    try {
        const crypto = await (0, exports.getCrypto)();
        return crypto.randomUUID();
    }
    catch (e) {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};
exports.generateId = generateId;
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
exports.sanitizeData = sanitizeData;
//# sourceMappingURL=utils.js.map