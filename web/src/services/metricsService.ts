import { doc, setDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const updateMetrics = async (
  clinicId: string,
  countryCode: string,
  updates: {
    patients_today?: number;
    active_queue?: number;
    in_consultation?: number;
    completed_today?: number;
    wait_time_minutes?: number; // pass wait time when completed
  }
) => {
  const today = new Date().toISOString().split('T')[0];
  
  const clinicRef = doc(db, 'clinic_metrics', `${clinicId}_${today}`);
  const countryRef = doc(db, 'country_metrics', `${countryCode}_${today}`);
  const globalRef = doc(db, 'global_metrics', `global_${today}`);

  const buildUpdate = (u: any) => {
    const res: any = { 
      last_updated: serverTimestamp(),
      clinic_id: clinicId,
      country_code: countryCode,
      date: today
    };
    if (u.patients_today) res.patients_today = increment(u.patients_today);
    if (u.active_queue) res.active_queue = increment(u.active_queue);
    if (u.in_consultation) res.in_consultation = increment(u.in_consultation);
    if (u.completed_today) res.completed_today = increment(u.completed_today);
    if (u.wait_time_minutes) res.total_wait_time = increment(u.wait_time_minutes);
    return res;
  };

  const updateData = buildUpdate(updates);
  const setOpts = { merge: true };
  
  try {
    await Promise.all([
      setDoc(clinicRef, updateData, setOpts),
      setDoc(countryRef, { ...updateData, clinic_id: undefined }, setOpts),
      setDoc(globalRef, { ...updateData, clinic_id: undefined, country_code: undefined }, setOpts)
    ]);

    // Update avg_wait_time
    if (updates.completed_today && updates.wait_time_minutes) {
      const updateAvg = async (ref: any) => {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.completed_today > 0 && data.total_wait_time > 0) {
            await setDoc(ref, { avg_wait_time: Math.floor(data.total_wait_time / data.completed_today) }, { merge: true });
          }
        }
      };
      await Promise.all([
        updateAvg(clinicRef),
        updateAvg(countryRef),
        updateAvg(globalRef)
      ]);
    }
  } catch (error) {
    console.error("Failed to update metrics:", error);
  }
};
