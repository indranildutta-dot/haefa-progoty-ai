# Agent Instructions

This file contains persistent instructions and references for AI agents working on the HAEFA Clinical Registry.

## 1. Registration Station Reference
The registration process is critical for data integrity and patient identification.
- **Documentation**: Refer to `/registration.md` for the full specification of fields, steps, and validation rules.
- **Key Constraints**:
  - Always maintain the **Bangladesh Residency Status** conditional logic (National ID vs. FDMN Number).
  - Always maintain **Automatic Minor Detection** (age < 18) and the corresponding parent/guardian fields.
  - Never allow `undefined` values in `TextField` components (use `value || ''`).
  - Ensure **FDMN Number** (fcn_number) and **National ID** follow the MoHA and BD National regex patterns respectively.

## 2. Live Station Queue Board Reference
The queue board provides real-time monitoring of patient flow and triage priority.
- **Documentation**: Refer to `/queue_board.md` for the full specification of visual design, triage halos, and age calculation rules.
- **Key Constraints**:
  - **Triage Halos**: Maintain the **6px solid border** with outer glow for patient avatars.
  - **Age Calculation**: Follow the **1Y vs 6M** logic (only years if >= 1, only months if < 1).
  - **Compact Layout**: Keep column widths at **200px** and split names into two lines.
  - **Real-time Updates**: Ensure `onSnapshot` listeners are correctly implemented for all stations.

## 3. Vitals Station Reference
The Vitals workflow is split into three modes (Body Measures, Vital Signs, Labs & Risk).
- **Documentation**: Refer to `/vitals_station.md` for the full specification of fields, thresholds, and logic.
- **Key Constraints**:
  - **Clinical Thresholds**: Always use the age-based thresholds for Heart Rate (HR) and Respiratory Rate (RR) as defined in `vitals_station.md`.
  - **Glucose Thresholds**: Use the EMR logic for FBG (Normal < 100, Alert >= 100, High >= 126) and RBG (Normal < 140, Alert >= 140, Critical >= 200).
  - **Patient Halo**: The halo color must reflect the highest severity across all vitals. **Nurse Override** takes absolute precedence if set.
  - **Safety Sentinel Sync**: Ensure the `useEffect` in `VitalsStation.tsx` is maintained to sync inputs with the top bar in real-time.
  - **Units**: Always display units clearly (kg, cm, bpm, %, °C, mmol/L).

## 4. Doctor Station Reference
The Doctor Station is the final point of clinical assessment and prescription.
- **Documentation**: Refer to `/doctor_station.md` for the full specification of assessment sections and CV Risk logic.
- **Key Constraints**:
  - **CV Risk Eligibility**: Only show CRA sections for patients aged **40-74**.
  - **WHO Risk Logic**: Use the South Asia specific matrices in `cvRisk.ts`.
  - **Independent Scrolling**: Maintain the `overflowY: 'auto'` on side panels to ensure independent scrolling.
  - **TB Logic**: Maintain the conditional activation of "Suspected TB" based on screening answers.
  - **Completion Logic**: Ensure all active sections are marked "Complete" before enabling "Send to Pharmacy".

## 5. Search & Identification
- Search must support multiple identifiers (NID, FDMN, Nepal ID, Phone).
- Results must display the patient photo for verification.
- Actions (Reprint, Edit, Start Visit) must remain functional across all country configurations.

## 6. User Management & Professional Credentials
- **Documentation**: Refer to `/user_management.md` for the full RBAC specification.
- **Key Constraints**:
  - **Professional IDs**: Always display `professional_reg_no` and `professional_body` on prescriptions (Doctor Station) and dispensing labels (Pharmacy Station).
  - **Designation**: Include the user's `designation` in the prescriber identification block.
  - **RBAC**: Ensure `doctor` and `nurse` roles have access to all clinical stations for their assigned clinics to support rural practitioner workflows.
  - **Missing Info Warning**: Maintain the amber warning on the **Operations** station (`/dashboard`) if `professional_reg_no` is missing for clinical staff.

## 7. Sacred Section Strategy (Regression Prevention)
To ensure that existing features, thresholds, and clinical logic are never lost during code updates, all agents MUST follow this protocol:

### The "Zero-Loss" Protocol
1.  **Mandatory Spec Review**: Before editing any station file (e.g., `DoctorStation.tsx`), the agent MUST read the corresponding `.md` file (e.g., `/doctor_station.md`).
2.  **Feature Comparison**: Compare the current code against the spec in the `.md` file to identify any "hidden" or conditional features (like age-based filters).
3.  **Surgical Edits**: Use `multi_edit_file` with targeted chunks. NEVER replace large UI blocks (e.g., an entire Accordion set) if you are only changing one field.
4.  **Threshold Preservation**: Never modify clinical thresholds (Heart Rate, BP, CRA scores) unless explicitly requested and documented in a spec change.

### Sacred Checklist per Station
- **Registration**: Bangladesh Residency (NID vs FDMN), Minor Detection (DOB vs age_years), Step-by-Step wizard flow.
- **Queue Board**: 200px column density, 2-line name split, 1Y vs 6M age logic, 6px Triage Halo.
- **Vitals - Body Measures**: BMI calculation, MUAC grading, pediatric clinical warning.
- **Vitals - Vital Signs**: Age-based HR/RR thresholds, SpO2 emergency triggers, Safety Sentinel real-time sync.
- **Vitals - Labs & Risk**: Unit conversion logic (mg/dL/mmol/L), Fasting/Random glucose thresholds, Hb sex/age/pregnancy specific ranges.
- **Doctor Station**: CRA eligibility (40-74), Systemic Examination (all 5 systems), TB screening logic, independent side-panel scrolling, pharmacist dispensing summary visibility.
- **CRA Calculation Integrity**: Calculations for both Lab and Non-Lab must ONLY proceed if all required fields are valid. Never default missing values to zero. Display `--%` if inputs are incomplete.
- **BP Medication Warning**: Always display a prominent Amber Clinical Warning if `onBPMedication` is "Yes", as risk may be underestimated.
- **CRA Locking & Overrides**: All pre-populated CRA fields (Age, Sex, BMI, SBP, Smoker, Diabetes) MUST be locked by default. Manual overrides must be recorded in the `overrides` array of the clinical assessment record.
- **Pharmacy**: Inventory-coupled dispensing, Substitution/Return-Later logic, Professional ID stamps on labels.
- **Operations & Advanced Analytics**: Real-time KPI aggregation, Bottleneck analysis, Triage distribution charts. AI-driven Gemini insights and over a dozen advanced reporting modules (e.g., Risk Stratification, TBSurveillance, MaternalHealthTracker, CVRiskAnalysis) with `ReportSectionWrapper`.
- **Offline & Connectivity Resilience (PWA)**: Global draft auto-save via `localforage` for clinical stations. A Service Worker (vite-plugin-pwa) for offline access. The `backgroundRetryQueue` which intercepts Firestore mutations (`updateDoc`, `setDoc`, `addDoc`) and safely buffers them for retry when connection restores, along with a top-level `NetworkStatusIndicator`.

### Documentation as Source of Truth
If a feature is implemented in code but missing from the `.md` file, the agent MUST update the `.md` file first to register it as a "Sacred Feature".
