# User Management & RBAC Reference

This document specifies how users are managed and how Role-Based Access Control (RBAC) is implemented in the HAEFA Clinical Registry.

## 1. User Profile Structure
Every user has a profile in the `users` collection in Firestore.
- **Fields**:
  - `uid`: Firebase Auth UID.
  - `email`: User's email address.
  - `name`: Full name of the user.
  - `role`: One of `global_admin`, `country_admin`, `doctor`, `nurse`, `pharmacy`, `registration`.
  - `isApproved`: Boolean. Must be `true` for any clinical station access (except for Global Admins).
  - `assignedCountries`: Array of country IDs (for `country_admin`).
  - `assignedClinics`: Array of clinic IDs (for all clinical roles).
  - `professional_reg_no`: Professional license number (BMDC/BNMC/PCB).
  - `professional_body`: The licensing body (e.g., BMDC).
  - `designation`: Official job title (e.g., Senior Nurse Practitioner).

## 2. Role Definitions & Permissions
The system uses a flat role structure with clinic-based scoping.

### Global Admin
- **Access**: Full access to all countries, all clinics, and the User Management Dashboard.
- **Identifiers**: Hardcoded emails (`indranil_dutta@haefa.org`, `ruhul_abid@haefa.org`) or `role: 'global_admin'`.

### Country Admin
- **Access**: Full access to all clinics within their `assignedCountries`.
- **User Management**: Can manage users within their assigned countries.

### Clinical Roles (Doctor, Nurse, Pharmacy, Registration)
- **Access**: Full access to all clinical stations (Registration, Vitals, Doctor, Pharmacy, Queue Board, Dashboard) for any clinic listed in their `assignedClinics`.
- **Rural Clinic Logic**: In rural settings, nurses often act as practitioners. Therefore, clinical roles are not strictly siloed by station in the UI; any approved staff member assigned to a clinic can access any station within that clinic session.

## 3. Professional Identification Requirements
To ensure legal validity of clinical outputs:
- **Prescriptions**: Must include the prescriber's name, designation, and registration number.
- **Dispensing Labels**: Must include the pharmacist's name and registration number.
- **Validation**: If `professional_reg_no` is missing, an amber warning is displayed on the Clinic Operations Dashboard for clinical staff.
- **Dispensing Summary**: The prescription includes a dispensing summary section if the pharmacist has finalized the medication dispensing. This captures dispensed quantities, substitutions, and return dates for out-of-stock items.

## 4. User Management Workflow
1. **Invite/Update**: Admins use the User Management Dashboard to set roles and clinic assignments.
2. **Approval**: Users are "Staged" by default. An admin must set `isApproved: true` before the user can select a clinic.
3. **Sync**: Permissions are synced via Firebase Functions to ensure Auth Custom Claims match Firestore profile data (where applicable).
