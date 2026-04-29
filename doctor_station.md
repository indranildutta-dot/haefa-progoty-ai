# Doctor Station Documentation

This document outlines the capabilities, clinical assessment workflow, and logic implemented for the Doctor Station in the HAEFA Progoty platform.

## 1. Station Overview

The Doctor Station is the primary clinical interface where physicians perform assessments, record diagnoses, and issue prescriptions.

| Feature | Description |
| :--- | :--- |
| **Patient Context** | Real-time summary of vitals, lab results, and triage status from previous stations. |
| **Historical Visits** | Quick access to the last two clinical encounters for trend analysis. |
| **Clinical Assessment** | A structured, multi-section workflow for recording symptoms and findings. |
| **Diagnosis & Notes** | Centralized area for primary diagnosis and clinical notes. |
| **Prescription System** | Interface for adding medications with dosage and duration. Generates a professional, high-density print template. |
| **Workflow Gating** | Ensures all mandatory assessments are complete before patient movement. Prescriptions are only generated after finalization. |
| **Professional Signatures** | Automated inclusion of prescriber's name, designation, and registration number on all outputs. |

---

## 2. Clinical Assessment Workflow

The Clinical Assessment is divided into several subsections, each with its own status tracking.

### Section Statuses
*   **Not Started (Gray)**: Initial state.
*   **In Progress (Yellow)**: Triggered as soon as any field in the section is modified.
*   **Complete (Green)**: Set manually by the doctor via "MARK COMPLETE" or automatically via "NO TO ALL".

### Subsection List
1.  **Complaints**: Dynamic list of patient complaints with date and duration.
2.  **TB Screening**: Core screening questions for Tuberculosis.
3.  **Suspected TB (Conditional)**: Detailed history for suspected PTB cases.
4.  **Cardiovascular Risk - Non Lab Based (Conditional)**: WHO 10-year risk assessment for patients aged 40-74.
5.  **Cardiovascular Risk - Lab Based (Conditional)**: WHO 10-year risk assessment including cholesterol for patients aged 40-74.
6.  **Physical Examination - General**: Anemia, Jaundice, Edema (Rating 0-3), and NAD switches.
7.  **Physical Examination - Systemic**: Focused free-text fields for Cardiovascular, Respiratory, Nervous, Abdominal, and Musculoskeletal systems.
8.  **Current Rx taken**: Recording of current medications.
9.  **Patient H/O illness**: History of chronic or acute diseases.
10. **Family H/O illness**: Family medical history.
11. **Vaccination**: Tracking of received vaccines and Nirog team involvement.
12. **Patient Social H/O**: Habits like smoking, alcohol, and drug use.
13. **Patient Wellbeing**: Mental health screening and physical limitation assessment.

### Workflow Controls
*   **ENABLE EDITING**: A switch to prevent accidental changes to a section.
*   **NO TO ALL**: Quickly marks all "Yes/No" questions in a section as "No" and sets status to "Complete".
*   **MARK COMPLETE**: Manually sets the section status to "Complete".

---

## 3. TB Screening & Suspected TB Logic

The platform implements a specific clinical pathway for Tuberculosis screening.

### TB Screening Fields
*   Cough > 2 Weeks?
*   LGERF? (Low Grade Evening Rise of Fever)
*   Night sweat?
*   Weight loss?
*   Contact history?

### Suspected TB Activation Criteria
The subsection **"Additional History for Suspected TB Cases (PTB only)"** becomes active and visible ONLY if:
*   **Cough > 2 Weeks** is "Yes"
*   **OR** at least **2 of the following** are "Yes": LGERF, Night Sweat, Weight Loss.

### Suspected TB Subsections
When active, these sections must also be marked "Complete" for the assessment to be finalized:
1.  **Additional Symptoms**: Breathlessness, Chest Pain, Loss of appetite, Hemoptysis.
2.  **Examination Finding**: Auscultation findings (Pleural effusion, Consolidation, Crepitation).
3.  **TB Past History**: Detailed history including year, evidence (Sputum, X-ray, etc.), treatment category, duration, and recovery status.

---

## 4. Cardiovascular Risk Assessment (CRA)

The platform implements the **WHO South Asia Cardiovascular Risk Charts** for patients aged **40 to 74 years**.

### 4.1 Clinical Validation & Integrity
*   **Mandatory Inputs**: Both Non-Lab and Lab-based calculators strictly require all input fields to be populated with valid data before a calculation is performed. 
*   **No Defaulting**: Missing values (e.g., Cholesterol or BMI) **MUST NOT** default to zero. If any field is missing or invalid, the result will display as `--%` and the risk category will be hidden.
*   **BP Medication Warning**: If a patient is marked as "On Blood Pressure Medication" (Yes), a prominent **Amber Clinical Warning** is displayed: *"Clinical Warning: Risk value may be underestimated due to current antihypertensive therapy (On BP Medication)."* This adheres to WHO HEARTS guidelines regarding underestimated risk in treated patients.

### 4.2 Non-Laboratory Based CRA
*   **Auto-population**: Pulls Age, Sex, BMI, Smoking Status, Diabetes Status (inferred from Labs), and Systolic BP from previous stations.
*   **Field Locking**: Pre-populated fields are **locked (read-only)** by default.
*   **Manual Override**: Doctors can click the **Edit/Override icon** next to any pre-populated field to unlock it.
*   **Override History**: Overridden fields are tracked in the `overrides` array. A clinical alert is generated in the assessment summary if vitals were manually adjusted.
*   **Calculation**: Uses the WHO Non-Lab chart (Age, Sex, Smoker, SBP, BMI, Diabetes).

### 4.3 Laboratory Based CRA
*   **Auto-population**: Same as Non-Lab based.
*   **Manual Inputs**: Requires **Total Cholesterol** and **HDL Cholesterol** (Mg/Dl).
*   **Calculation**: Uses the WHO Lab-based chart (Age, Sex, Smoker, SBP, Total Cholesterol, Diabetes).
*   **Validation**: Calculation is bypassed if Total Cholesterol is missing or zero.

---

## 5. Patient Data & History Display

### Station Data Summary (Left Panel)
Displays a read-only snapshot of all data collected in previous stations.
*   **Independent Scrolling**: The panel has its own scrollbar, allowing doctors to review vitals and labs without moving the main assessment form.
*   **Content**: Weight, Height, BMI, MUAC, BP, HR, RR, SpO2, Temp, Glucose, Hb, Allergies, and Social Risks.

### Historical Visits (Right Panel)
*   **Independent Scrolling**: Allows reviewing previous visit notes and trends independently.
*   **Timeline**: Provides a timeline of the **last two visits**. Doctors can toggle between "Last Visit" and "2nd Last Visit" to view detailed vitals and clinical notes from those encounters.

---

## 6. Prescription & Finalization

### Prescription Generation
The platform generates a professional, high-density prescription template using MUI Grid and Card components.
*   **Header**: Includes Clinic Logo, Clinic Details, and a unique Encounter ID.
*   **Patient Banner**: Displays Patient Name, Age, Sex, Patient Code, and Date.
*   **Clinical Summary**: Structured blocks for Chief Complaints, O/E (Vitals), and Provisional Diagnosis.
*   **Medication Table**: Optimized table showing Drug Name, Dosage, Frequency, Duration, and Instructions.
*   **Footer**: Includes Advice, Follow-up Date, and Referral sections.
*   **Automated Signature**: The prescriber's name, designation, professional body, and registration number are automatically appended to the footer from their user profile.

### Completion Requirements
The "SEND TO PHARMACY" button is enabled only when:
1.  A **Primary Diagnosis** is entered.
2.  **ALL** active Clinical Assessment subsections are marked **Complete (Green)**.
    *   *Note: If Suspected TB is not active, those sections are ignored by the completion logic.*

### Post-Finalization
*   Consultation data is persisted to Firestore.
*   The `localforage` Draft Auto-Save (handled by `useFormAutoSave`) is cleared out to avoid staleness.
*   Patient status in the queue is updated to `WAITING_FOR_PHARMACY`.
*   The doctor is returned to the waiting list view.

---

## 6. Technical Dependencies
*   **`PrescriptionPrintTemplate.tsx`**: The new professional, high-density print template for prescriptions.
*   **`PrintPrescriptionDialog.tsx`**: Dialog for previewing and printing the prescription.
*   **`ClinicalAssessmentPanel.tsx`**: Main component for the assessment workflow, including CV Risk logic.
*   **`ConsultationPanel.tsx`**: Orchestrates assessment, diagnosis, and prescriptions.
*   **`DoctorDashboard.tsx`**: Main screen managing the queue and finalization logic.
*   **`VitalsSnapshot.tsx`**: Component for the Station Data Summary.
*   **`PatientHistoryTimeline.tsx`**: Component for the historical visits panel.
*   **`cvRisk.ts`**: Utility containing the WHO risk matrices and calculation logic.
*   **`encounterService.ts`**: Handles `saveConsultation` and `getVitalsByEncounter`.
*   **`initialClinicalAssessment`**: Defines the default state and structure for assessment data.
