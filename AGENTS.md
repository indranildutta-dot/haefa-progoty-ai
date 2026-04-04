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

## 3. Search & Identification
- Search must support multiple identifiers (NID, FDMN, Nepal ID, Phone).
- Results must display the patient photo for verification.
- Actions (Reprint, Edit, Start Visit) must remain functional across all country configurations.
