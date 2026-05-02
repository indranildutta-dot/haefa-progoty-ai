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
  - `assignedClinics`: Array of clinic IDs (Source of truth for clinical station access).
  - `professional_reg_no`: Professional license number (BMDC/BNMC/PCB).
  - `professional_body`: The licensing body (e.g., BMDC).
  - `designation`: Official job title (e.g., Senior Nurse Practitioner).

## 2. Role Definitions & Permissions
The system uses a tiered Role-Based Access Control (RBAC) structure. Permissions are scoped by Clinic, Country, or Global level.

### 2.1 Global Admin (`global_admin`)
- **Primary Objective**: System-wide oversight and configuration.
- **Capabilities**:
  - Full access to the **User Management** dashboard (`/users`) to manage all staff across the entire system.
  - Full access to **Advanced Reporting** (`/analytics`) with global aggregation capabilities.
  - Can access any clinic operations without restriction.
  - Can delete users permanently from the system.
- **Access Scope**: System-wide (All countries, all clinics).

### 2.2 Country Admin (`country_admin`)
- **Primary Objective**: Regional management and reporting.
- **Capabilities**:
  - Access to the **User Management** dashboard (`/users`) but restricted to managing users within their `assignedCountries`.
  - Access to **Advanced Reporting** (`/analytics`) aggregated for their assigned countries.
  - Full access to all clinical stations and **Operations** for clinics within their assigned countries.
- **Access Scope**: Restricted to `assignedCountries`.

### 2.3 Doctor (`doctor`)
- **Primary Objective**: Clinical assessment, diagnosis, and prescription.
- **Capabilities**:
  - Full access to **Doctor Station** for diagnostic assessment.
  - Access to **Vitals Station** (Body Measures, Vital Signs, Labs & Risk) to review or input patient data.
  - Access to **Registration** and **Pharmacy** stations to support clinic flow.
  - Access to the **Operations** dashboard for real-time triage awareness.
- **Access Scope**: Restricted to `assignedClinics`.

### 2.4 Nurse (`nurse`)
- **Primary Objective**: Triage, vitals collection, and primary care support.
- **Capabilities**:
  - Primary operator of **Vitals Station** (Body Measures, Vital Signs, Labs & Risk).
  - High-level access to **Doctor Station** (Act as practitioners in rural settings where doctors may be unavailable).
  - Full access to **Registration** and **Queue Board**.
  - Access to **Operations** dashboard for flow monitoring.
- **Access Scope**: Restricted to `assignedClinics`.

### 2.5 Pharmacist (`pharmacist`)
- **Primary Objective**: Medication dispensing and inventory management.
- **Capabilities**:
  - Full access to **Pharmacy** station for dispensing and inventory tracking.
  - Can view clinical assessments in the **Doctor Station** to verify prescriptions.
  - Access to **Queue Board** and **Operations**.
- **Access Scope**: Restricted to `assignedClinics`.

### 2.6 Registration (`registration`)
- **Primary Objective**: Patient intake, identification, and card printing.
- **Capabilities**:
  - Full access to **Registration Station**.
  - Access to **Queue Board** to monitor patient arrivals.
- **Access Scope**: Restricted to `assignedClinics`.

## 3. Station Visibility Matrix
| Station | Global Admin | Country Admin | Doctor | Nurse | Pharmacist | Registration |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| User Management (`/users`) | ✅ | ✅ (Scoped) | ❌ | ❌ | ❌ | ❌ |
| Advanced Reporting (`/analytics`) | ✅ | ✅ (Scoped) | ❌ | ❌ | ❌ | ❌ |
| Operations (`/dashboard`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vitals Stations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Doctor Station | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pharmacy & Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Queue Board | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Note: Clinical staff (`doctor`, `nurse`, `pharmacist`, `registration`) must have `isApproved: true` and be checked into an `assignedClinic` to access the clinical stations.*

## 4. Professional Identification Requirements
To ensure legal validity of clinical outputs:
- **Prescriptions**: Must include the prescriber's name, designation, and registration number.
- **Dispensing Labels**: Must include the pharmacist's name and registration number.
- **Validation**: If `professional_reg_no` is missing, an amber warning is displayed on the Clinic Operations Dashboard for clinical staff.
- **Dispensing Summary**: The prescription includes a dispensing summary section if the pharmacist has finalized the medication dispensing. This captures dispensed quantities, substitutions, and return dates for out-of-stock items.

## 4. User Management Workflow
1. **Invite/Update**: Admins use the User Management Dashboard to set roles and clinic assignments.
2. **Approval**: Users are "Staged" by default. An admin must set `isApproved: true` before the user can select a clinic.
3. **Sync**: Permissions are synced via Firebase Functions to ensure Auth Custom Claims match Firestore profile data (where applicable).
