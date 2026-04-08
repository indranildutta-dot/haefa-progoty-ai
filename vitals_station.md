# Vitals Station Documentation

This document outlines the capabilities, data collection fields, clinical thresholds, and logic implemented for the three Vitals Stations in the HAEFA Progoty platform.

## 1. Station Overview

The Vitals workflow is split into three distinct modes (stations), typically handled by different staff or at different points in the clinic flow.

| Mode | Station Name | Primary Focus |
| :--- | :--- | :--- |
| 1 | Body Measures | Physical measurements (Weight, Height, MUAC) |
| 2 | Vital Signs | Physiological signs (BP, HR, RR, SpO2, Temp) |
| 3 | Labs & Risk | Biochemical tests (Glucose, Hb) and Risk Factors |

---

## 2. Data Collection & Thresholds

### Mode 1: Body Measures
*   **Fields**: Weight (kg), Height (cm), MUAC (cm).
*   **Auto-Calculations**: BMI, BMI Class, MUAC Class.
*   **BMI Thresholds**:
    *   **Underweight**: < 18.5
    *   **Healthy Weight**: 18.5 - 24.9
    *   **Overweight**: 25 - 29.9
    *   **Obese**: ≥ 30
*   **MUAC Thresholds**:
    *   **Severely Malnourished**: < 11.5
    *   **Moderately Malnourished**: 11.5 - 12.4
    *   **Normal**: ≥ 12.5

### Mode 2: Vital Signs
*   **Fields**: Systolic BP, Diastolic BP, Heart Rate (bpm), Respiratory Rate (bpm), SpO2 (%), Temperature (°C), Blood Group, Pregnancy Status, Pregnancy Months.
*   **Blood Pressure (BP)**:
    *   **Critical**: Systolic ≥ 180 OR Diastolic ≥ 120
    *   **Warning**: Systolic ≥ 130 OR Diastolic ≥ 80
*   **Heart Rate (HR) - Age-Based**:
    *   *Newborn (0y 0m)*: 100-160
    *   *Infant (0y >0m)*: 100-150
    *   *Child (1-2y)*: 98-140
    *   *Child (3-5y)*: 80-120
    *   *Child (6-12y)*: 75-110
    *   *Adult/Teen (>12y)*: 60-100
    *   **Emergency**: Outside range.
    *   **Urgent**: Within 5 bpm of range boundaries.
*   **Respiratory Rate (RR) - Age-Based**:
    *   *Infant (<1y)*: 30-60
    *   *Child (1-12y)*: 18-30
    *   *Adult/Teen (>12y)*: 12-20
    *   **Emergency**: Outside range.
    *   **Urgent**: Within 2 bpm of range boundaries.
*   **Oxygen Saturation (SpO2)**:
    *   **Emergency**: < 88%
    *   **Critical**: 88-89%
    *   **Warning**: 90-92%
    *   **Normal**: > 92%
*   **Temperature**:
    *   **Critical**: ≥ 40°C
    *   **Warning**: ≥ 38.5°C

### Mode 3: Labs & Risk
*   **Fields**: RBG (mg/dL or mmol/L), FBG (mg/dL or mmol/L), Fasting Status (Yes/No), Has Symptoms (Yes/No), Hemoglobin (g/dL or g/L), Allergies, Social History (Smoking, Chewing Tobacco, Betel Nuts, Recreational Drugs, Housing, Water Source), Alcohol Use.
*   **Unit Support**:
    *   **Glucose**: Supports both `mg/dL` and `mmol/L`. Internal storage and triage logic use `mg/dL` (Conversion: `mmol/L * 18 = mg/dL`).
    *   **Hemoglobin**: Supports both `g/dL` and `g/L`. Internal storage and triage logic use `g/dL` (Conversion: `g/L / 10 = g/dL`).
*   **Fasting Blood Glucose (FBG)**:
    *   **High (Emergency)**: ≥ 126 mg/dL
    *   **Alert (Urgent)**: 100-125 mg/dL
    *   **Normal**: < 100 mg/dL
*   **Random Blood Glucose (RBG)**:
    *   **Critical (Emergency)**: ≥ 200 mg/dL
    *   **Alert (Urgent)**: 140-199 mg/dL
    *   **Normal**: < 140 mg/dL
*   **Hemoglobin (Hb) - Age/Sex/Pregnancy Based**:
    *   **Severe Anemia (Emergency)**: < 7.0 g/dL
    *   **Anemia (Urgent)**:
        *   *Children (6m - 5y)*: < 11.0 g/dL
        *   *Children (5y - 11y)*: < 11.5 g/dL
        *   *Children (12y - 14y)*: < 12.0 g/dL
        *   *Adult Men*: < 13.0 g/dL
        *   *Adult Women (Non-pregnant)*: < 12.0 g/dL
        *   *Pregnant Women*: < 11.0 g/dL
*   **Safety Validations (Impossible Values)**:
    *   **Glucose**: Rejects values < 20 or > 600 mg/dL.
    *   **Hemoglobin**: Rejects values < 3 or > 25 g/dL.
*   **Pediatric Note**: A clinical warning is displayed for all patients under 18: "* Clinical interpretation required for pediatrics".

---

## 3. UI & UX Capabilities

### Compact UI Design
To minimize scrolling and improve efficiency on tablets, all input fields (TextFields, Selects, Switches) use a compact design with reduced padding and font sizes. This allows the entire vital signs form to be visible with minimal vertical movement.

### Safety Sentinel Sync
A real-time synchronization mechanism in `VitalsStation.tsx` using a `useEffect` hook. It monitors all vital input fields and updates the global `selectedPatient` state as the nurse types. This ensures the top bar (PatientContextBar) and any other dependent components reflect the latest data and triage status instantly.

---

## 4. Core Logic & Systems

### Data Persistence (Smart Merging)
To ensure data integrity across the three triage modes, the platform implements a **Smart Merging** strategy:
*   **Mode-Specific Blanking**: When a nurse starts a triage session, the form fields for the *current* mode are initialized as blank (NaN) to ensure a fresh reading.
*   **Background Preservation**: Fields from *other* modes are fetched from the database and preserved in the background state. This ensures the top bar highlights remain accurate.
*   **Incremental Saving**: The `saveVitals` service filters out `NaN` and `undefined` values before updating Firestore. This prevents "empty" fields in the current form from overwriting valid data recorded in previous stations.

### Triage Calculation (`evaluateTriage`)
A utility function that processes all current vitals and patient age to suggest a triage level.
*   **Emergency**: Triggered by any `isCritical` flag (e.g., BP 180/120, SpO2 < 90) or if 2 or more `urgent` flags are present.
*   **Urgent**: Triggered by exactly 1 `urgent` flag (e.g., BP 140/90, HR slightly out of range).
*   **Standard**: Default for normal vitals.

### Patient Halo Color (`getHighestAlertColor`)
The halo (border/shadow) around the patient's picture in the `PatientContextBar` reflects the highest clinical risk identified.
*   **Priority Order**: Red (Emergency/Critical) > Yellow (Urgent/Warning) > Green (Normal) > Gray (Pending).
*   **Factors**: Triage Level, BP, HR, RR, SpO2, BMI, Glucose.
*   **Nurse Override**: If the nurse manually selects a priority (Nurse Override), this value **takes absolute precedence** over the system-calculated color.

### Previous History Display
The `PatientHistoryTimeline.tsx` component fetches and displays all previous `VitalsRecord` entries for a patient. It uses the same threshold logic to highlight abnormal values in past visits, providing clinical context to the current provider.

---

## 4. Technical Dependencies
*   **`queueService`**: Handles patient status updates (e.g., moving from `WAITING_FOR_VITALS` to `WAITING_FOR_DOCTOR`).
*   **`encounterService`**: Manages the persistence of `VitalsRecord` to Firestore.
*   **`useAppStore`**: Zustand store for global state management (Patient, Clinic, Notifications).
*   **`triage.ts`**: Centralized utility for all clinical threshold logic.
