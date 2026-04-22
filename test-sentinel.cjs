const admin = require("firebase-admin");
const ts = admin.firestore.FieldValue.serverTimestamp();
console.log("constructor name:", ts.constructor?.name);
console.log("is methodname string:", typeof ts._methodName === 'string');
console.log("is sentinel:", ts._sentinel !== undefined);
console.log(ts);
