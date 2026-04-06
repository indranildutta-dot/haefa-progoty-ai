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
| **Prescription System** | Interface for adding medications with dosage and duration. |
| **Workflow Gating** | Ensures all mandatory assessments are complete before patient movement. |

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
4.  **Physical Examination - General**: Anemia, Jaundice, Edema (Rating 0-3), and NAD switches.
5.  **Physical Examination - Systemic**: Free-text area for systemic findings.
6.  **Current Rx taken**: Recording of current medications.
7.  **Patient H/O illness**: History of chronic or acute diseases.
8.  **Family H/O illness**: Family medical history.
9.  **Vaccination**: Tracking of received vaccines and Nirog team involvement.
10. **Patient Social H/O**: Habits like smoking, alcohol, and drug use.
11. **Patient Wellbeing**: Mental health screening and physical limitation assessment.

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

## 4. Patient Data & History Display

### Station Data Summary (Left Panel)
Displays a read-only snapshot of all data collected in previous stations:
*   **Body Measures**: Weight, Height, BMI, MUAC.
*   **Vital Signs**: BP, HR, RR, SpO2, Temp.
*   **Labs & Risks**: Glucose levels, Hemoglobin, Allergies, and Social Risk factors.

### Historical Visits (Right Panel)
Provides a timeline of the **last two visits**. Doctors can toggle between "Last Visit" and "2nd Last Visit" to view detailed vitals and clinical notes from those encounters.

---

## 5. Finalization & Movement

### Completion Requirements
The "SEND TO PHARMACY" button is enabled only when:
1.  A **Primary Diagnosis** is entered.
2.  **ALL** active Clinical Assessment subsections are marked **Complete (Green)**.
    *   *Note: If Suspected TB is not active, those sections are ignored by the completion logic.*

### Post-Finalization
*   Consultation data is persisted to Firestore.
*   Patient status in the queue is updated to `WAITING_FOR_PHARMACY`.
*   The doctor is returned to the waiting list view.

---

## 6. Technical Dependencies
*   **`ClinicalAssessmentPanel.tsx`**: Main component for the assessment workflow.
*   **`ConsultationPanel.tsx`**: Orchestrates assessment, diagnosis, and prescriptions.
*   **`DoctorDashboard.tsx`**: Main screen managing the queue and finalization logic.
*   **`encounterService.ts`**: Handles `saveConsultation` and `getVitalsByEncounter`.
*   **`initialClinicalAssessment`**: Defines the default state and structure for assessment data.
