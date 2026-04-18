import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  enableIndexedDbPersistence,
  terminate,
  clearIndexedDbPersistence
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import firebaseConfig from "./firebase-applet-config.json";

// Validate config before initialization
export const isFirebaseConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder" && !!firebaseConfig.projectId;

if (!isFirebaseConfigValid) {
  console.error("CRITICAL: Firebase configuration is missing or incomplete in firebase-applet-config.json");
}

const dummyConfig = { 
  apiKey: "placeholder", 
  projectId: "placeholder", 
  authDomain: "placeholder", 
  storageBucket: "placeholder", 
  messagingSenderId: "placeholder", 
  appId: "placeholder" 
};

// Initialize App
const app = initializeApp(isFirebaseConfigValid ? firebaseConfig : dummyConfig);

/**
 * INITIALIZE FIRESTORE
 * We use experimentalForceLongPolling to bypass environments where WebSockets are blocked (like some iFrames).
 */
let db: any;
try {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  
  // Initialize with settings
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, dbId === '(default)' ? undefined : dbId);

  console.log(`HAEFA: Firestore Initialized (DB: ${dbId}) using Long Polling`);
} catch (error) {
  console.error("HAEFA: Failed to initialize Firestore with custom settings, falling back to default:", error);
  db = getFirestore(app);
}

// Initialize other services
export const auth = getAuth(app);
export const storage = isFirebaseConfigValid && firebaseConfig.storageBucket ? getStorage(app) : null;
export const functions = getFunctions(app, "us-central1");

/**
 * CRITICAL CONSTRAINT: Connection Health Check
 * When the application initially boots, call getDocFromServer to verify connectivity.
 */
export async function testFirebaseConnection() {
  if (!isFirebaseConfigValid) return;
  
  try {
    console.log("HAEFA: Testing Firebase connectivity...");
    // Try to fetch a dummy doc from the server to bypass cache
    await getDocFromServer(doc(db, '_health_check', 'connection'));
    console.log("HAEFA: Connection to Firestore backend established successfully.");
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.warn("HAEFA: Firestore backend unreachable. Operating in offline mode.");
      console.error("HAEFA: Check network or Firebase console to ensure the database exists and matches your config.");
    } else {
      // It's okay if the document doesn't exist, as long as it reaches the server
      console.log("HAEFA: Firestore backend reachable (Handshake verified).");
    }
  }
}

// Kick off the connection test immediately
testFirebaseConnection();

export { db };
