import { Vitals, TriageLevel } from '../types';

export interface TriageResult {
  triage_level: TriageLevel;
  priority_score: number;
  triage_reason: string;
  isCritical: boolean;
}

export const evaluateTriage = (vitals: Partial<Vitals>): TriageResult => {
  const reasons: string[] = [];
  let isCritical = false;
  let urgentCount = 0;

  // Critical thresholds
  if (vitals.temperature && vitals.temperature >= 40) {
    reasons.push(`Temperature ${vitals.temperature}°C (Critical)`);
    isCritical = true;
  } else if (vitals.temperature && vitals.temperature >= 39) {
    reasons.push(`Temperature ${vitals.temperature}°C`);
    urgentCount++;
  }

  if (vitals.heartRate && vitals.heartRate >= 140) {
    reasons.push(`Pulse ${vitals.heartRate} bpm (Critical)`);
    isCritical = true;
  } else if (vitals.heartRate && vitals.heartRate >= 120) {
    reasons.push(`Pulse ${vitals.heartRate} bpm`);
    urgentCount++;
  }

  if (vitals.systolic && vitals.systolic >= 200) {
    reasons.push(`Systolic BP ${vitals.systolic} (Critical)`);
    isCritical = true;
  } else if (vitals.systolic && vitals.systolic >= 180) {
    reasons.push(`Systolic BP ${vitals.systolic}`);
    urgentCount++;
  }

  if (vitals.diastolic && vitals.diastolic >= 120) {
    reasons.push(`Diastolic BP ${vitals.diastolic} (Critical)`);
    isCritical = true;
  } else if (vitals.diastolic && vitals.diastolic >= 110) {
    reasons.push(`Diastolic BP ${vitals.diastolic}`);
    urgentCount++;
  }

  let triage_level: TriageLevel = 'standard';
  let priority_score = 50;

  if (isCritical) {
    triage_level = 'emergency';
    priority_score = 100;
  } else if (urgentCount >= 2) {
    triage_level = 'emergency';
    priority_score = 100;
  } else if (urgentCount === 1) {
    triage_level = 'urgent';
    priority_score = 75;
  }

  const triage_reason = reasons.length > 0 ? reasons.join(', ') : 'Normal vitals';

  return {
    triage_level,
    priority_score,
    triage_reason,
    isCritical
  };
};
