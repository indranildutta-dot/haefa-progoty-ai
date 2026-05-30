import { Vitals, TriageLevel } from '../types';

export interface TriageResult {
  triage_level: TriageLevel;
  priority_score: number;
  triage_reason: string;
  isCritical: boolean;
}

export const evaluateTriage = (vitals: Partial<Vitals>, age_years: number = 25, age_months: number = 0, gender?: string): TriageResult => {
  const reasons: string[] = [];
  let isCritical = false;
  let urgentCount = 0;

  // Sanitize age to ensure null/undefined/NaN values are robustly handled
  let resolvedAgeYears = age_years;
  if (resolvedAgeYears === null || resolvedAgeYears === undefined || isNaN(resolvedAgeYears)) {
    resolvedAgeYears = 25; // Default to adult
  }
  let resolvedAgeMonths = age_months;
  if (resolvedAgeMonths === null || resolvedAgeMonths === undefined || isNaN(resolvedAgeMonths)) {
    resolvedAgeMonths = 0;
  }

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

    if (resolvedAgeYears === 0 && resolvedAgeMonths === 0) {
      hrLow = 100;
      hrHigh = 160;
      population = "Newborn";
    } else if (resolvedAgeYears === 0 && resolvedAgeMonths > 0) {
      hrLow = 100;
      hrHigh = 150;
      population = "Infant";
    } else if (resolvedAgeYears >= 1 && resolvedAgeYears <= 2) {
      hrLow = 98;
      hrHigh = 140;
      population = "Child (1-2y)";
    } else if (resolvedAgeYears >= 3 && resolvedAgeYears <= 5) {
      hrLow = 80;
      hrHigh = 120;
      population = "Child (3-5y)";
    } else if (resolvedAgeYears >= 6 && resolvedAgeYears <= 12) {
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

  // Respiratory Rate Checks (Age-based)
  if (vitals.respiratoryRate !== undefined) {
    let rrLow = 12;
    let rrHigh = 20;
    let population = "Adult/Teen";

    if (resolvedAgeYears < 1) {
      rrLow = 30;
      rrHigh = 60;
      population = "Infant";
    } else if (resolvedAgeYears >= 1 && resolvedAgeYears <= 12) {
      rrLow = 18;
      rrHigh = 30;
      population = "Child";
    }

    if (vitals.respiratoryRate > rrHigh) {
      reasons.push(`${population} RR ${vitals.respiratoryRate} rpm (High)`);
      urgentCount++;
    } else if (vitals.respiratoryRate < rrLow) {
      reasons.push(`${population} RR ${vitals.respiratoryRate} rpm (Low)`);
      urgentCount++;
    }
  }

  // Temperature Checks
  if (vitals.temperature !== undefined && !isNaN(vitals.temperature)) {
    if (vitals.temperature > 40) {
      reasons.push(`Temperature ${vitals.temperature}°C (Emergency)`);
      isCritical = true;
    } else if (vitals.temperature >= 38.5 && vitals.temperature <= 40) {
      reasons.push(`Temperature ${vitals.temperature}°C (Urgent)`);
      urgentCount++;
    }
  }

  // Blood Pressure Checks
  // Use second reading if available, otherwise first
  const s = (vitals.systolic_2 !== undefined && vitals.systolic_2 !== null && !isNaN(vitals.systolic_2) && vitals.systolic_2 > 0) ? vitals.systolic_2 : vitals.systolic;
  const d = (vitals.diastolic_2 !== undefined && vitals.diastolic_2 !== null && !isNaN(vitals.diastolic_2) && vitals.diastolic_2 > 0) ? vitals.diastolic_2 : vitals.diastolic;

  if (s !== undefined && s > 0 && !isNaN(s)) {
    if (s > 130 || s < 70) {
      reasons.push(`Systolic BP ${s} mmHg (Critical)`);
      isCritical = true;
    } else if ((s >= 120 && s <= 130) || (s >= 70 && s < 80)) {
      reasons.push(`Systolic BP ${s} mmHg (Warning)`);
      urgentCount++;
    }
  }

  if (d !== undefined && d > 0 && !isNaN(d)) {
    if (d > 90 || d < 50) {
      reasons.push(`Diastolic BP ${d} mmHg (Critical)`);
      isCritical = true;
    } else if ((d >= 80 && d <= 90) || (d >= 50 && d < 60)) {
      reasons.push(`Diastolic BP ${d} mmHg (Warning)`);
      urgentCount++;
    }
  }

  // Glucose Checks
  if (vitals.fbg !== undefined && vitals.fbg > 0) {
    if (vitals.fbg >= 126) {
      reasons.push(`FBG ${vitals.fbg} mg/dL (Diabetes Range)`);
      isCritical = true;
    } else if (vitals.fbg < 55) {
      reasons.push(`FBG ${vitals.fbg} mg/dL (Severe Hypoglycemia)`);
      isCritical = true;
    } else if (vitals.fbg < 70) {
      reasons.push(`FBG ${vitals.fbg} mg/dL (Hypoglycemia)`);
      urgentCount++;
    } else if (vitals.fbg >= 100) {
      reasons.push(`FBG ${vitals.fbg} mg/dL (Prediabetes)`);
      urgentCount++;
    }
  }

  if (vitals.rbg !== undefined && vitals.rbg > 0) {
    if (vitals.rbg >= 200) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Critical Alert)`);
      isCritical = true;
    } else if (vitals.rbg < 55) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Severe Hypoglycemia)`);
      isCritical = true;
    } else if (vitals.rbg < 70) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Hypoglycemia)`);
      urgentCount++;
    } else if (vitals.rbg >= 140) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Elevated)`);
      urgentCount++;
    }
  }

  // Hemoglobin Checks
  if (vitals.hemoglobin !== undefined && vitals.hemoglobin > 0) {
    const isMale = gender?.toLowerCase() === 'male';
    const isPregnant = !!vitals.is_pregnant;

    if (resolvedAgeYears < 15) {
      let threshold = 12.0;
      if (resolvedAgeYears === 0 && resolvedAgeMonths >= 1) threshold = 10.5;
      else if (resolvedAgeYears >= 1 && resolvedAgeYears <= 5) threshold = 11.0;
      else if (resolvedAgeYears >= 6 && resolvedAgeYears <= 11) threshold = 11.5;
      else if (resolvedAgeYears >= 12 && resolvedAgeYears <= 14) threshold = 12.0;

      if (vitals.hemoglobin < 7) {
        reasons.push(`Hb ${vitals.hemoglobin} g/dL (Severe Anemia)`);
        isCritical = true;
      } else if (vitals.hemoglobin < threshold) {
        reasons.push(`Hb ${vitals.hemoglobin} g/dL (Anemia)`);
        urgentCount++;
      }
    } else {
      // Adults
      if (isMale) {
        if (vitals.hemoglobin > 17.5) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (High Hb)`);
          urgentCount++;
        } else if (vitals.hemoglobin < 7.0) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (Severe Anemia)`);
          isCritical = true;
        } else if (vitals.hemoglobin < 13.0) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (Anemia)`);
          urgentCount++;
        }
      } else {
        const lowerLimitNormal = isPregnant ? 11.0 : 12.0;
        if (vitals.hemoglobin > 15.5) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (High Hb)`);
          urgentCount++;
        } else if (vitals.hemoglobin < 7.0) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (Severe Anemia)`);
          isCritical = true;
        } else if (vitals.hemoglobin < lowerLimitNormal) {
          reasons.push(`Hb ${vitals.hemoglobin} g/dL (Anemia)`);
          urgentCount++;
        }
      }
    }
  }

  // BMI Checks
  if (vitals.bmi_class === 'Obese') {
    reasons.push(`BMI Class: Obese`);
    urgentCount++;
  } else if (vitals.bmi_class === 'Underweight') {
    reasons.push(`BMI Class: Underweight`);
    urgentCount++;
  }

  // MUAC Checks
  if (vitals.muac_class === 'Severely Malnourished') {
    reasons.push(`MUAC: Severely Malnourished`);
    isCritical = true;
  } else if (vitals.muac_class === 'Moderately Malnourished') {
    reasons.push(`MUAC: Moderately Malnourished`);
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
