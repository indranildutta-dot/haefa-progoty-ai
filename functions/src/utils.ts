import { HttpsError } from "firebase-functions/v2/https";

// ==========================================
// LAZY LOADERS
// ==========================================

let adminCache: typeof import("firebase-admin") | null = null;
export const getAdmin = async () => {
  if (!adminCache) {
    adminCache = await import("firebase-admin");
    if (!adminCache.apps.length) {
      adminCache.initializeApp();
    }
  }
  return adminCache;
};

export const getDb = async () => {
  const admin = await getAdmin();
  return admin.firestore();
};

export const getCrypto = async () => {
  return await import("crypto");
};

// ==========================================
// CONFIGURATION & GLOBAL SETTINGS
// ==========================================
export const SUPER_ADMIN_EMAILS = [
  'indranil_dutta@haefa.org', 
  'ruhul_abid@haefa.org'
];

export const REQUISITION_THRESHOLD = 500;

/**
 * Helper to verify if the caller is a Global Admin
 */
export const checkIsGlobalAdmin = (auth: any) => {
  if (!auth) return false;
  const email = auth.token.email?.toLowerCase();
  const role = auth.token.role;
  return SUPER_ADMIN_EMAILS.includes(email) || role === 'global_admin';
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const generateId = async () => {
  try {
    const crypto = await getCrypto();
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

export const sanitizeData = (data: any) => {
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
