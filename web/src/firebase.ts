import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// These should be set in your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate config before initialization
export const isFirebaseConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder" && !!firebaseConfig.projectId;

if (!isFirebaseConfigValid) {
  console.warn("Firebase configuration is missing or incomplete. Please check your environment variables.");
}

const dummyConfig = { apiKey: "placeholder", projectId: "placeholder", authDomain: "placeholder", storageBucket: "placeholder", messagingSenderId: "placeholder", appId: "placeholder" };

const app = initializeApp(isFirebaseConfigValid ? firebaseConfig : dummyConfig);

// Initialize services safely
let dbInstance;
let authInstance;
let storageInstance;

try {
  // Use initializeFirestore with experimentalForceLongPolling to bypass WebSocket blocking issues
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
  authInstance = getAuth(app);
  
  // Only initialize storage if the bucket is configured
  if (isFirebaseConfigValid && firebaseConfig.storageBucket && firebaseConfig.storageBucket !== "placeholder") {
    storageInstance = getStorage(app);
  } else {
    console.warn("Firebase Storage bucket not configured. Storage features will be unavailable.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase services:", error);
}

export const db = dbInstance!;
export const auth = authInstance!;
export const storage = storageInstance; // Removed the ! to allow it to be undefined if not configured
