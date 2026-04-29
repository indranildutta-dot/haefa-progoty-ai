import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import icd11Data from '../data/icd11PrimaryCareSouthAsia.json'; // Ensure this can be imported

enum OperationType {
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export const seedICD11ToFirestore = async () => {
  try {
    let batch = writeBatch(db);
    let count = 0;
    let totalSeeded = 0;

    for (let i = 0; i < icd11Data.length; i++) {
        const item = icd11Data[i];
        if (!item.code) continue;

        const docRef = doc(db, 'icd11_common', item.code);
        batch.set(docRef, { ...item });

        count++;
        if (count === 500) {
            await batch.commit();
            totalSeeded += count;
            console.log(`Committed chunk of 500...`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        totalSeeded += count;
    }

    console.log(`Seeding complete! Successfully uploaded ${totalSeeded} records to 'icd11_common'.`);
    alert(`Seeding complete! Successfully uploaded ${totalSeeded} records.`);
  } catch (error) {
    console.error("Error seeding ICD-11 data: ", error);
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: OperationType.WRITE,
      path: 'icd11_common',
      authInfo: {}
    };
    alert("Error seeding data.");
    throw new Error(JSON.stringify(errInfo));
  }
};
