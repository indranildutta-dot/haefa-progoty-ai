import localforage from 'localforage';
import CryptoJS from 'crypto-js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient } from '../types';

// Configure localforage
localforage.config({
  name: 'HAEFA_Offline_DB',
  storeName: 'offline_cache'
});

const getEncryptionKey = () => {
  // In a real production app, you might derive this from the user's auth token or a PIN.
  // Using a static key for demonstration of the concept
  return 'haefa-local-encryption-key-vx1';
};

export const encryptData = (data: any): string => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), getEncryptionKey()).toString();
};

export const decryptData = (cipherText: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, getEncryptionKey());
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedData);
  } catch (e) {
    console.error("Failed to decrypt local data", e);
    return null;
  }
};

/**
 * Downloads a lightweight subset of patient data for offline identification.
 */
export const syncClinicPatientsToLocalIndex = async (clinicId: string, onProgress?: (msg: string) => void) => {
  try {
    if (onProgress) onProgress("Fetching patients from cloud...");
    const q = query(collection(db, "patients"), where("clinicId", "==", clinicId));
    const querySnapshot = await getDocs(q);
    
    // We only keep the fields necessary for search to keep the index "mini"
    const miniIndex = querySnapshot.docs.map(doc => {
      const data = doc.data() as Patient;
      return {
        id: doc.id,
        given_name: data.given_name,
        family_name: data.family_name,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        phone: data.phone,
        national_id: data.national_id,
        fcn_number: data.fcn_number,
        photo_url: data.photo_url || null, // Keep photo URL for verification
      };
    });

    if (onProgress) onProgress("Caching patient photos for offline access...");
    const photoUrls = miniIndex.map(p => p.photo_url).filter(url => !!url) as string[];
    
    if (photoUrls.length > 0 && 'caches' in window) {
      const cache = await caches.open('haefa-patient-photos');
      let cachedCount = 0;
      const BATCH_SIZE = 10; // Avoid network overload
      
      for (let i = 0; i < photoUrls.length; i += BATCH_SIZE) {
        const batch = photoUrls.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (url) => {
          try {
            const exists = await cache.match(url);
            if (!exists) {
               // Use no-cors to handle opaque responses from storage if CORS isn't perfect
               const req = new Request(url, { mode: 'no-cors' });
               const res = await fetch(req);
               await cache.put(req, res);
            }
          } catch(e) {
             console.warn("Failed to cache photo url:", url);
          }
        }));
        cachedCount += batch.length;
        if (onProgress) onProgress(`Cached photos: ${Math.min(cachedCount, photoUrls.length)} / ${photoUrls.length}`);
      }
    }

    if (onProgress) onProgress("Encrypting local index...");
    const encryptedData = encryptData(miniIndex);
    await localforage.setItem(`mini_patient_index_${clinicId}`, encryptedData);
    await localforage.setItem(`mini_patient_index_last_sync_${clinicId}`, new Date().toISOString());
    console.log(`Successfully synced ${miniIndex.length} patients and their photos.`);
    if (onProgress) onProgress("Patient list and photos synced offline.");
  } catch (error) {
    console.error("Error syncing clinic patients to local index:", error);
    throw error;
  }
};

/**
 * Searches the local mini index.
 */
export const searchPatientsOffline = async (clinicId: string, searchTerm: string): Promise<any[]> => {
  try {
    const encryptedData = await localforage.getItem<string>(`mini_patient_index_${clinicId}`);
    if (!encryptedData) return [];

    const miniIndex = decryptData(encryptedData);
    if (!miniIndex || !Array.isArray(miniIndex)) return [];

    const term = searchTerm.toLowerCase();
    return miniIndex.filter((p: any) => {
      const fullName = `${p.given_name || ''} ${p.family_name || ''}`.toLowerCase();
      const phoneMatch = p.phone?.includes(term);
      const nidMatch = p.national_id?.includes(term);
      const fcnMatch = p.fcn_number?.toLowerCase().includes(term);
      const nameMatch = fullName.includes(term);
      
      return phoneMatch || nidMatch || fcnMatch || nameMatch;
    });
  } catch (error) {
    console.error("Error searching local index:", error);
    return [];
  }
};

/**
 * Syncs other clinical metadata (medications list, default lab configs, etc.)
 */
export const syncClinicalMetadataToLocalIndex = async (clinicId: string) => {
    try {
        const q = query(collection(db, "clinics", clinicId, "inventory"));
        const snapshot = await getDocs(q);
        
        const inventory = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        await localforage.setItem(`clinical_metadata_inventory_${clinicId}`, encryptData(inventory));
        await localforage.setItem(`clinical_metadata_last_sync`, new Date().toISOString());
        console.log(`Synced ${inventory.length} inventory items offline.`);
    } catch (e) {
        console.error("Metadata sync failed:", e);
    }
};

export const getOfflineInventory = async (clinicId: string): Promise<any[]> => {
    try {
        const encryptedData = await localforage.getItem<string>(`clinical_metadata_inventory_${clinicId}`);
        if (!encryptedData) return [];
        const inventory = decryptData(encryptedData);
        return Array.isArray(inventory) ? inventory : [];
    } catch (error) {
        console.error("Error retrieving offline inventory:", error);
        return [];
    }
};

export const getLocalSyncStatus = async (clinicId: string) => {
    const lastSync = await localforage.getItem<string>(`mini_patient_index_last_sync_${clinicId}`);
    const metadataSync = await localforage.getItem<string>(`clinical_metadata_last_sync`);
    return {
        patientListLastSync: lastSync,
        metadataLastSync: metadataSync
    };
};
