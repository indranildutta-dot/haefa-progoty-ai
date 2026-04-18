# Pharmacy Station Documentation

This document serves as the definitive reference for the **Pharmacy Station** implementation in the HAEFA Clinical Registry. It details the dispensing workflow, inventory management, and technical requirements.

## 1. Overview
The Pharmacy Station is the final point in the patient journey. It allows pharmacists to view prescriptions, dispense medications (including substitutions), and manage clinic-specific inventory.

## 2. Dispensing Workflow
Patients appear in the Pharmacy queue after the Doctor finalizes their consultation.

### 2.1. Prescription Review
The pharmacist selects a patient and views:
- **Prescription List**: Name, dosage, frequency, duration, and instructions.
- **Triage Context**: Current vitals (BP, Glucose, etc.) to ensure safety.

### 2.2. Dispensing Options
For each prescribed medication, the pharmacist chooses a mode:
- **Dispensed**: Item is in stock and given as prescribed.
- **Substitute**: Item is out of stock; a clinically equivalent item is dispensed.
- **Not Dispensed / Return Later**: Item is out of stock and no substitute is available.

### 2.3. Conditional Fields
- **Substitution**: Selecting "Substitute" opens fields for **Substitution Medication** and **Reason**.
- **Return Date**: Selecting "Return Later" or "Substitute" (if applicable) allows setting a **Return Date** for the patient to collect missing items.

### 2.4. Finalization
- **Dispensing Summary**: A summary of all dispensing actions is generated and appended to the encounter record.
- **Status Update**: Upon completion, the patient's queue status is updated to `VISIT_COMPLETED`.

## 3. Inventory Management
The Pharmacy contains an Integrated Inventory Dashboard.
- **Stock Levels**: Real-time view of quantity on hand for all medications in the specific clinic.
- **Alerts**: Highlighted rows for low stock or expired medications.
- **Batch Management**: Supports tracking of expiry dates per inventory batch.

## 4. Technical Implementation Details
- **Collection**: `prescriptions` (filtered by `encounter_id`), `clinics/{clinic_id}/inventory`.
- **RBAC**: Requires `pharmacy` role or higher, and the user must be approved and assigned to the current clinic.
- **Dispensing Logic**: 
  - `dispensingModes`: Record of chosen mode per prescription ID.
  - `substitutionMeds`: Record of substituted items.
  - `returnDates`: Record of scheduled collection dates.

## 5. Sacred Features & Conservation
1. **Never bypass inventory checks**: Ensure all dispensing actions are tracked against available stock where possible.
2. **Mandatory return dates**: Always allow patients to be scheduled for returns if items are missing.
3. **Professional Credentials**: The dispensing summary must include the name and registration number of the dispensing pharmacist.
4. **Safety Sentinel**: Ensure triage alerts (halo colors) are visible even in the pharmacy to prevent dispensing mistakes for critical patients.
