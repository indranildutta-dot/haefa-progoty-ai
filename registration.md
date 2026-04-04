# Patient Registration Station Documentation

This document serves as the definitive reference for the **Registration Station** implementation in the HAEFA Clinical Registry. It details the search functionality, new patient registration workflow, conditional logic, and validation rules.

## 1. Overview
The Registration Station is the entry point for all patients. It allows clinicians to search for existing records or register new patients. The UI is optimized for tablet use with large touch targets and a step-by-step wizard.

## 2. Search Functionality
Clinicians can search for patients using multiple identifiers.

### Search Fields
- **Given Name / Family Name**: Partial string matching.
- **Phone Number**: Primary contact search.
- **Identity Numbers (Country Specific)**:
  - **Bangladesh**: National ID, FDMN Number (formerly Rohingya Number).
  - **Nepal**: Nepal ID, Bhutanese Refugee ID.

### Search Results
Each result displays:
- **Patient Photo**: Captured during registration.
- **Full Name**: Given and Family name.
- **Gender & ID**: Primary identifier displayed.
- **Last Visit Date**: Fetched from the encounters collection.

### Available Actions
- **REPRINT**: Opens a badge modal to reprint the patient's Health Card (Badge).
- **EDIT**: Loads the patient's data into the registration form for updates.
- **START VISIT**: Creates a new encounter and adds the patient to the **Vitals Station** queue.

---

## 3. New Patient Registration Workflow
The registration process is divided into three steps.

### Step 0: Basic Information
- **Photo Capture**: Required for all new patients.
- **Names**: Given Name (Required), Middle Name, Family Name (Required).
- **Gender**: Male, Female, Other (Required).
- **Age Determination**:
  - **Date of Birth**: Format `DD/MM/YYYY`.
  - **Estimated Birth Year**: Used if DOB is unknown.
- **Minor Detection (Automatic)**:
  - If calculated age is **< 18 years**, the system automatically flags the patient as a minor.
  - **Parent/Guardian Fields**: Father's Given/Family Name and Mother's Given/Family Name appear automatically in Step 0 when a minor is detected.

### Step 1: Identity & Credentials
- **Primary Contact**: Phone number.
- **Marital Status**: Single, Married, Divorced, Widowed.
- **Nepal Specifics**:
  - **Nepal ID**: 10-digit Citizen ID.
  - **Bhutanese Refugee ID**: 5-8 or 10-12 digit ID.

### Step 2: Address & Contact
This step contains the most significant conditional logic for Bangladesh.

#### Residency Status (Bangladesh Only)
Clinicians must select one of two options:
1. **Bangladesh National**:
   - **National ID**: Required (validated for 10, 13, or 17 digits).
   - **Address Fields**: Village, District, Upazila, Union, Post Code.
2. **FDMN Camp Member (Rohingya Refugee)**:
   - **FDMN Number**: Required (MoHA format validation).
   - **Camp Fields**: Camp Name, Block Number, Majhi/Captain Name, Tent Number.

#### Common Fields
- **Detailed Address / Landmark**: Multiline text for specific location details.
- **Permanent Address Toggle**: "Same as permanent address" switch.

---

## 4. Validation Rules (Regular Expressions)
Strict validation is enforced on blur and during form submission.

| Field | Regex / Rule | Error Message |
| :--- | :--- | :--- |
| **Date of Birth** | `^(\d{2})/(\d{2})/(\d{4})$` | "Invalid format. Use DD/MM/YYYY." |
| **National ID (BD)** | `^(\d{10}\|\d{13}\|\d{17})$` | "Invalid NID (10, 13, or 17 digits)." |
| **FDMN Number (BD)** | Alphanumeric with hyphen (8-15 chars) OR 17-digit starting with 1 | "Invalid MoHA format." |
| **Nepal ID** | `^\d{10}$` | "Invalid Citizen ID (10 digits)." |
| **Bhutanese Refugee ID** | `^\d{5,8}$` OR `^\d{10,12}$` | "Invalid Refugee ID." |

---

## 5. Technical Implementation Details
- **Controlled Inputs**: All `TextField` components must use `value={newPatient.field || ''}` to prevent controlled/uncontrolled warnings.
- **State Management**:
  - `newPatient`: Holds the current form data.
  - `initialPatientState`: Used to reset the form and ensure all fields are defined.
  - `validationErrors`: Tracks regex failures for real-time UI feedback.
- **Firebase Integration**:
  - **Collection**: `patients`.
  - **ID Generation**: `doc(collection(db, 'patients')).id` is called on mount to allow photo upload before the record is saved.
  - **Timestamps**: Uses `serverTimestamp()` for `created_at` and `updated_at`.
- **Badge Generation**: Uses `qrcode` library to generate a token in the format `HAEFA-[patient_id_prefix]`.

## 6. Future Preservation
When adding features:
1. **Do not remove** the `fcn_number` or `rohingya_number` fields as they are critical for FDMN reporting.
2. **Do not disable** the automatic minor detection logic in `calculateIsMinor`.
3. **Maintain the conditional rendering** in `renderStepContent` for Step 2 (BD Residency Status).
4. **Ensure all new inputs** are added to `initialPatientState` with an empty string default.
