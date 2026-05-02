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

## 3. Inventory & Procurement Management
The Pharmacy contains an Integrated Inventory Dashboard and a smart Procurement Engine.

### 3.1. Inventory View
- **Stock Levels**: Real-time view of quantity on hand for all medications in the specific clinic.
- **Alerts**: Highlighted rows for low stock or expired medications.
- **Batch Management**: Supports tracking of expiry dates per inventory batch.

### 3.2. Procurement Report (Dynamic Reconciliation)
The system automatically generates a procurement report based on dispensing shortfalls and inventory levels.
- **Triggers**: An item appears on the report if **Total Stock < 200** units OR any batch **Expires within 90 days**.
- **Reconciliation**: Items are automatically removed from the report once new stock is added (total >= 200) and no batches are expiring. 
- **The Buy List**: Displays a calculated shortfall: `(Sum of Requisitions) - (Current On-hand Stock)`.
- **In-Transit Tracking**: Pharmacists can "Mark as Ordered" to move items to a `Pending Delivery` state, visually graying them out to prevent duplicate orders.
- **New Medicine Flagging**: Medicines prescribed by doctors that are not found in the global `medications_catalog` are flagged with a "New Medicine" badge for administrative review.

### 3.3. Dispensing History & Staff Performance
- **Search Filter**: Advanced filtering by date range and **Staff Member** (Doctor/Pharmacist).
- **Activity Summary**: Provides a visual summary of all medications prescribed (by doctor) or dispensed (by pharmacist) during the selected period.
- **Prescriber Tracking**: The history table includes a dedicated "Prescriber" column for clinical audit.

## 4. Technical Implementation Details
- **Collections**: `prescriptions`, `requisitions` (for procurement), `medications_catalog`, `inventory`, `users`.
- **Procurement Logic**: 
  - `reconciledProcurement`: A memoized filter checking `inventory` levels and `expiry_date` against `requisition` records.
  - `EXPIRY_ALERT`: Automatically triggered by the `onBatchUpdate` cloud function when stock updates.
- **RBAC**: Requires `pharmacy` role or higher, verified status, and assignment to the current clinic via `assignedClinics`.

## 5. Sacred Features & Conservation
1. **Never bypass inventory checks**: Ensure all dispensing actions are tracked against available stock where possible.
2. **Dynamic Reconciliation**: The procurement report must always reflect live inventory levels to prevent over-ordering.
3. **90-Day Expiry Guard**: Any batch expiring within 90 days must trigger a procurement alert regardless of quantity.
4. **Staff Activity Summary**: Maintain the prescription/dispensing summary blocks when filtering history by staff.
5. **Professional Credentials**: The dispensing summary must include the name and registration number of the dispensing pharmacist.
6. **Safety Sentinel**: Ensure triage alerts (halo colors) are visible even in the pharmacy to prevent dispensing mistakes for critical patients.
