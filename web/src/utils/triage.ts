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
    let hrLow = 60;
    let hrHigh = 100;
    let population = "Adult/Teen";

    if (age_years === 0 && age_months === 0) {
      hrLow = 100;
      hrHigh = 160;
      population = "Newborn";
    } else if (age_years === 0 && age_months > 0) {
      hrLow = 100;
      hrHigh = 150;
      population = "Infant";
    } else if (age_years >= 1 && age_years <= 2) {
      hrLow = 98;
      hrHigh = 140;
      population = "Child (1-2y)";
    } else if (age_years >= 3 && age_years <= 5) {
      hrLow = 80;
      hrHigh = 120;
      population = "Child (3-5y)";
    } else if (age_years >= 6 && age_years <= 12) {
      hrLow = 75;
      hrHigh = 110;
      population = "Child (6-12y)";
    }

    if (vitals.heartRate > hrHigh) {
      reasons.push(`${population} Pulse ${vitals.heartRate} bpm (High)`);
      urgentCount++;
    } else if (vitals.heartRate < hrLow) {
      reasons.push(`${population} Pulse ${vitals.heartRate} bpm (Low)`);
      urgentCount++;
    }
  }

  // Temperature Checks
  if (vitals.temperature && vitals.temperature >= 40) {
    reasons.push(`Temperature ${vitals.temperature}°C (Critical)`);
    isCritical = true;
  } else if (vitals.temperature && vitals.temperature >= 38.5) {
    reasons.push(`Temperature ${vitals.temperature}°C`);
    urgentCount++;
  }

  // Blood Pressure Checks
  // Use second reading if available, otherwise first
  const s = vitals.systolic_2 !== undefined ? vitals.systolic_2 : vitals.systolic;
  const d = vitals.diastolic_2 !== undefined ? vitals.diastolic_2 : vitals.diastolic;

  if (s !== undefined) {
    if (s >= 180) {
      reasons.push(`Systolic BP ${s} (Critical)`);
      isCritical = true;
    } else if (s >= 130) {
      reasons.push(`Systolic BP ${s} (Warning)`);
      urgentCount++;
    }
  }

  if (d !== undefined) {
    if (d >= 120) {
      reasons.push(`Diastolic BP ${d} (Critical)`);
      isCritical = true;
    } else if (d >= 80) {
      reasons.push(`Diastolic BP ${d} (Warning)`);
      urgentCount++;
    }
  }

  // Glucose Checks
  if (vitals.fbg !== undefined && vitals.fbg > 0) {
    if (vitals.fbg >= 126) {
      reasons.push(`FBG ${vitals.fbg} mmol/L (High)`);
      isCritical = true;
    } else if (vitals.fbg >= 100) {
      reasons.push(`FBG ${vitals.fbg} mmol/L (Alert)`);
      urgentCount++;
    }
  }

  if (vitals.rbg !== undefined && vitals.rbg > 0) {
    if (vitals.rbg >= 200) {
      reasons.push(`RBG ${vitals.rbg} mmol/L (Critical)`);
      isCritical = true;
    } else if (vitals.rbg >= 140) {
      reasons.push(`RBG ${vitals.rbg} mmol/L (Alert)`);
      urgentCount++;
    }
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
