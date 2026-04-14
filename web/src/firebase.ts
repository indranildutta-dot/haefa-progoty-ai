import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { FirestoreErrorInfo, OperationType } from "./utils/firestoreError";

// Firebase configuration hardcoded to ensure it's available in all environments
// These values match the haefa-progoty-dev project provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyAai0cJ3SClGBpZxHreeRh1UHWJwYRYh_U",
  authDomain: "haefa-progoty-dev.firebaseapp.com",
  projectId: "haefa-progoty-dev",
  storageBucket: "haefa-progoty-dev.firebasestorage.app",
  messagingSenderId: "743965284964",
  appId: "1:743965284964:web:106116d29809a8fb471d71",
  firestoreDatabaseId: "(default)"
};

// Validate config before initialization
export const isFirebaseConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder" && !!firebaseConfig.projectId;

if (!isFirebaseConfigValid) {
  console.warn("Firebase configuration is missing or incomplete. Please check your firebase-applet-config.json.");
}

const dummyConfig = { apiKey: "placeholder", projectId: "placeholder", authDomain: "placeholder", storageBucket: "placeholder", messagingSenderId: "placeholder", appId: "placeholder" };

const app = initializeApp(isFirebaseConfigValid ? firebaseConfig : dummyConfig);

// Initialize services safely
let dbInstance;
let authInstance;
let storageInstance;
let functionsInstance;

try {
  // Use initializeFirestore with experimentalForceLongPolling to bypass WebSocket blocking issues
  // Also respect the named database if provided in the config
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, (firebaseConfig as any).firestoreDatabaseId || '(default)');
  
  authInstance = getAuth(app);
  
  // Only initialize storage if the bucket is configured
  if (isFirebaseConfigValid && firebaseConfig.storageBucket && firebaseConfig.storageBucket !== "placeholder") {
    storageInstance = getStorage(app);
  } else {
    console.warn("Firebase Storage bucket not configured. Storage features will be unavailable.");
  }
  
  // Initialize Functions
  functionsInstance = getFunctions(app, "us-central1");
} catch (error) {
  console.error("Failed to initialize Firebase services:", error);
}

export const db = dbInstance!;
export const auth = authInstance!;
export const storage = storageInstance;
export const functions = functionsInstance!;
