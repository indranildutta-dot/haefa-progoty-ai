import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const archiveOldData = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const collections = ['encounters', 'vitals', 'diagnoses', 'prescriptions'];

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName)
      .where('created_at', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.create(db.collection(`${collectionName}_archive`).doc(doc.id), doc.data());
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
});
