const admin = require("firebase-admin");
const serviceAccount = require("./firebase-applet-config.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
async function check() {
  const snapshot = await db.collection("prescriptions").where("status", "==", "DISPENSED").limit(1).get().catch(e => console.error(e));
  if (!snapshot || snapshot.empty) {
    console.log("No dispensed prescriptions found.");
    
    const any = await db.collection("prescriptions").limit(1).get();
    console.log("Any prescription:", any.docs.map(d => d.data()));
  } else {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log("Found:", doc.id, JSON.stringify(data, null, 2));
    });
  }
}
check();
