import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seed = async () => {
  console.log("Seeding medications...");
  
  const meds = [
    { name: "amoxicillin", maxDailyDose: 3000, unit: "mg" },
    { name: "ibuprofen", maxDailyDose: 3200, unit: "mg" },
    { name: "paracetamol", maxDailyDose: 4000, unit: "mg" },
    { name: "lisinopril", maxDailyDose: 40, unit: "mg" },
    { name: "aspirin", maxDailyDose: 4000, unit: "mg" },
    { name: "warfarin", maxDailyDose: 10, unit: "mg" }
  ];

  for (const m of meds) {
    await addDoc(collection(db, "medications"), m);
  }

  console.log("Seeding interactions...");
  const interactions = [
    {
      medication1Name: "ibuprofen",
      medication2Name: "aspirin",
      severity: "high",
      description: "Increased risk of bleeding and gastrointestinal toxicity."
    },
    {
      medication1Name: "warfarin",
      medication2Name: "aspirin",
      severity: "high",
      description: "Significantly increased risk of severe bleeding."
    }
  ];

  for (const i of interactions) {
    await addDoc(collection(db, "drug_interactions"), i);
  }

  console.log("Done seeding.");
  process.exit(0);
};

seed().catch(console.error);
