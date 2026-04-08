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
