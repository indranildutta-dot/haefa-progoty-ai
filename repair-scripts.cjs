const admin = require("firebase-admin");
const serviceAccount = require("./firebase-applet-config.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
async function repair() {
  // Find prescriptions with status 'DISPENSED' where updated_at is an empty object
  const limitDate = new Date();
  limitDate.setHours(limitDate.getHours() - 1);
  
  const snapshot = await db.collection("prescriptions").where("status", "==", "DISPENSED").get();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Check if updated_at is missing or is an empty object
    const isBadTimestamp = !data.updated_at || (typeof data.updated_at === 'object' && Object.keys(data.updated_at).length === 0);
    
    if (isBadTimestamp) {
        // Find the encounter related to this prescription to estimate the time
        let repairTime = admin.firestore.FieldValue.serverTimestamp();
        if (data.encounter_id) {
            const enc = await db.collection("encounters").doc(data.encounter_id).get();
            if (enc.exists && enc.data().updated_at) {
                repairTime = enc.data().updated_at;
            }
        }
        
        console.log(`Repairing ${doc.id}`);
        await doc.ref.update({
            updated_at: repairTime,
            dispensedDate: data.dispensedDate && Object.keys(data.dispensedDate).length === 0 ? repairTime : data.dispensedDate
        });
        count++;
    }
  }
  
  console.log(`Repaired ${count} prescriptions.`);
}

repair().catch(console.error);
