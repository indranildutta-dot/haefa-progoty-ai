import * as admin from 'firebase-admin';

// ==========================================
// INITIALIZATION
// ==========================================

export const getAdmin = async () => admin;
export const getDb = async () => {
  const db = admin.firestore(); // This defaults to (default)
  return db;
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

export const REQUISITION_THRESHOLD = 200;

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

export const deepSanitize = (data: any): any => {
  if (data === undefined) return null;
  if (data === null) return null;
  
  // Handle Numbers - convert NaN and Infinity to null as Firestore doesn't support them
  if (typeof data === 'number') {
    if (isNaN(data) || !isFinite(data)) return null;
    return data;
  }

  // Handle Dates
  if (data instanceof Date) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(v => deepSanitize(v));
  }
  
  if (typeof data === 'object') {
    // IMPROVED: Safely check for Firestore FieldValue
    const constructorName = data.constructor?.name;
    const isFieldValue = (data instanceof admin.firestore.FieldValue) ||
                         constructorName === 'FieldValue' || 
                         constructorName === 'FirestoreFieldValue' ||
                         constructorName?.endsWith('Transform') ||
                         (typeof data._methodName === 'string') ||
                         (data._sentinel !== undefined);
                         
    const isTimestamp = (data instanceof admin.firestore.Timestamp) || 
                        constructorName === 'Timestamp' ||
                        (typeof data.toDate === 'function' && typeof data.toMillis === 'function');
    
    if (isFieldValue || isTimestamp) {
      return data;
    }

    // Handle standard objects
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = deepSanitize(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
};

export const sanitizeData = (data: any) => {
  return deepSanitize(data);
};
