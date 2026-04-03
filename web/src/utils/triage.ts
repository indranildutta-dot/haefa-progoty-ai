import { Vitals, TriageLevel } from '../types';

export interface TriageResult {
  triage_level: TriageLevel;
  priority_score: number;
  triage_reason: string;
  isCritical: boolean;
}

export const evaluateTriage = (vitals: Partial<Vitals>, age_years: number = 25, age_months: number = 0): TriageResult => {
  const reasons: string[] = [];
  let isCritical = false;
  let urgentCount = 0;

  // SpO2 Checks
  if (vitals.oxygenSaturation !== undefined) {
    if (vitals.oxygenSaturation < 88) {
      reasons.push(`SpO2 ${vitals.oxygenSaturation}% (Emergency)`);
      isCritical = true;
    } else if (vitals.oxygenSaturation >= 88 && vitals.oxygenSaturation < 90) {
      reasons.push(`SpO2 ${vitals.oxygenSaturation}% (Critical)`);
      isCritical = true;
    } else if (vitals.oxygenSaturation >= 90 && vitals.oxygenSaturation <= 92) {
      reasons.push(`SpO2 ${vitals.oxygenSaturation}% (Warning)`);
      urgentCount++;
    }
  }

  // Heart Rate Checks (Age-based)
  if (vitals.heartRate !== undefined) {
    let hrLow = 50;
    let hrHigh = 120;
    let population = "Adult";

    if (age_years < 1 || (age_years === 0 && age_months > 0)) {
      hrLow = 100;
      hrHigh = 180;
      population = "Infant";
    } else if (age_years >= 1 && age_years <= 12) {
      hrLow = 60;
      hrHigh = 140;
      population = "Child";
    }

    if (vitals.heartRate > hrHigh) {
      reasons.push(`${population} Pulse ${vitals.heartRate} bpm (High)`);
      isCritical = true;
    } else if (vitals.heartRate < hrLow) {
      reasons.push(`${population} Pulse ${vitals.heartRate} bpm (Low)`);
      isCritical = true;
    }
  }

  // Temperature Checks
  if (vitals.temperature && vitals.temperature >= 40) {
    reasons.push(`Temperature ${vitals.temperature}°C (Critical)`);
    isCritical = true;
  } else if (vitals.temperature && vitals.temperature >= 39) {
    reasons.push(`Temperature ${vitals.temperature}°C`);
    urgentCount++;
  }

  // Blood Pressure Checks
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
