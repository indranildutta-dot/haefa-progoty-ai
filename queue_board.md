# Live Station Queue Board Documentation

This document serves as the definitive reference for the **Live Station Queue Board** implementation in the HAEFA Clinical Registry. It details the visual design, triage logic, age calculation rules, and technical architecture.

## 1. Overview
The Live Station Queue Board provides a real-time, high-density overview of all patients currently in the clinic. It is designed for large displays (dashboards) and tablet use, allowing clinic managers to monitor patient flow and identify bottlenecks.

## 2. Visual Architecture
The board is organized into five functional columns representing the clinical workflow:
1. **Body Measures**: Initial registration and physical measurements.
2. **Vitals**: Vital signs collection (BP, HR, Temp, etc.).
3. **Labs & Risk**: Laboratory investigations and clinical risk assessments.
4. **Doctor**: Consultation with the medical officer.
5. **Pharmacy**: Medication dispensing and counseling.

### Column Header
Each column displays:
- **Station Name**: Large, bold typography.
- **Patient Count**: A circular badge showing the total number of patients currently in that station.

---

## 3. Patient Queue Card Design
The cards are optimized for high density while maintaining legibility.

### Triage Halo (Prominent Border)
Each patient's avatar is surrounded by a **6px solid border** (halo) with a subtle outer glow. The color indicates the triage priority:
- **Red (#ef4444)**: Emergency (Critical priority).
- **Yellow (#f59e0b)**: Urgent (High priority).
- **Green (#10b981)**: Standard (Routine priority).

### Patient Information
- **Name Layout**: The patient's First Name and Last Name are displayed on two separate lines to prevent horizontal truncation and ensure the card remains narrow.
- **Age & Gender**:
  - **Age >= 1 Year**: Displays only the year (e.g., `56Y`, `1Y`).
  - **Age < 1 Year**: Displays only the months (e.g., `6M`, `11M`).
  - **Missing Data**: If no birth date or year is available, the age field is hidden entirely.
  - **Gender**: Displayed as `M` or `F`.
- **Waiting Time**: Displayed prominently at the bottom (e.g., `WAITING: 2 hr 15 min`).

---

## 4. Logical Implementations

### Age Calculation Logic (`calculateAgeDisplay`)
The system follows strict rules for age representation to ensure clinical relevance:
1. **Explicit Age Fields**: Uses `age_years` and `age_months` if available.
2. **DOB Calculation**: If `date_of_birth` (DD/MM/YYYY) is present, it calculates the difference from the current date.
3. **Estimated Year**: Falls back to `estimated_birth_year` if no exact date exists.
4. **Formatting**:
   - If age is 1 year or older, return `[Years]Y`.
   - If age is less than 1 year, return `[Months]M`.
   - If no data is available, return an empty string (hiding the field).

### Waiting Time Calculation
Waiting time is calculated as the difference between the patient's `created_at` timestamp (when they entered the current station) and the current system time.

---

## 5. Technical Implementation Details

### Data Structures
- **Interface**: `QueuePatient` (defined in `src/types.ts`).
- **Collection**: `queue` (Firestore).
- **Status Mapping**:
  - `REGISTERED` -> Body Measures
  - `WAITING_FOR_VITALS` -> Vitals
  - `WAITING_FOR_VITALS_2` -> Labs & Risk
  - `WAITING_FOR_VITALS_3` -> Doctor
  - `READY_FOR_DOCTOR` / `IN_CONSULTATION` -> Doctor
  - `WAITING_FOR_PHARMACY` -> Pharmacy

### Components
- **`QueueBoard.tsx`**: Main container; handles Firestore `onSnapshot` listeners and patient caching.
- **`PatientQueueCard.tsx`**: Individual patient card component; handles halo colors and name splitting.
- **`QueuePatientDetailDrawer.tsx`**: Modal drawer that appears when a card is clicked; displays vitals, diagnosis, and allows moving the patient to the next station.

---

## 6. Future Preservation
When modifying the Queue Board:
1. **Maintain Density**: Do not increase the card width beyond `200px` to ensure all 5 columns fit on standard screens.
2. **Halo Prominence**: Do not reduce the halo width or glow, as it is the primary visual indicator for triage.
3. **Age Rules**: Adhere to the `1Y` vs `6M` logic; do not revert to showing birth years (e.g., `1980Y`).
4. **Name Splitting**: Always split names into two lines to support long names in narrow columns.
