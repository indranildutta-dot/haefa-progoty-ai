const admin = require("firebase-admin");
const ts = admin.firestore.FieldValue.serverTimestamp();
console.log("instanceof FieldValue?", ts instanceof admin.firestore.FieldValue);
console.log("constructor endsWith transform?", ts.constructor?.name?.endsWith('Transform'));
