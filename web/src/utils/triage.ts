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

  // Respiratory Rate Checks (Age-based)
  if (vitals.respiratoryRate !== undefined) {
    let rrLow = 12;
    let rrHigh = 20;
    let population = "Adult/Teen";

    if (age_years < 1) {
      rrLow = 30;
      rrHigh = 60;
      population = "Infant";
    } else if (age_years >= 1 && age_years <= 12) {
      rrLow = 18;
      rrHigh = 30;
      population = "Child";
    }

    if (vitals.respiratoryRate > rrHigh) {
      reasons.push(`${population} RR ${vitals.respiratoryRate} bpm (High)`);
      urgentCount++;
    } else if (vitals.respiratoryRate < rrLow) {
      reasons.push(`${population} RR ${vitals.respiratoryRate} bpm (Low)`);
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
      reasons.push(`FBG ${vitals.fbg} mg/dL (High)`);
      isCritical = true;
    } else if (vitals.fbg >= 100) {
      reasons.push(`FBG ${vitals.fbg} mg/dL (Alert)`);
      urgentCount++;
    }
  }

  if (vitals.rbg !== undefined && vitals.rbg > 0) {
    if (vitals.rbg >= 200) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Critical)`);
      isCritical = true;
    } else if (vitals.rbg >= 140) {
      reasons.push(`RBG ${vitals.rbg} mg/dL (Alert)`);
      urgentCount++;
    }
  }

  // Hemoglobin Checks
  if (vitals.hemoglobin !== undefined && vitals.hemoglobin > 0) {
    let threshold = 12.0;
    const isMale = false; // Simplified for triage utility, ideally passed in
    const isPregnant = !!vitals.is_pregnant;

    if (age_years < 5) threshold = 11.0;
    else if (age_years <= 11) threshold = 11.5;
    else if (age_years <= 14) threshold = 12.0;
    else {
      if (isPregnant) threshold = 11.0;
      // Note: Gender check would be better if we had it here
      else threshold = 12.0; 
    }

    if (vitals.hemoglobin < 7) {
      reasons.push(`Hb ${vitals.hemoglobin} g/dL (Severe Anemia)`);
      isCritical = true;
    } else if (vitals.hemoglobin < threshold) {
      reasons.push(`Hb ${vitals.hemoglobin} g/dL (Anemia)`);
      urgentCount++;
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
