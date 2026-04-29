# Operations Documentation

This document serves as the definitive reference for the **Operations** station (formerly Clinic Operations Dashboard). It details the administrative overview, performance metrics, and bottleneck analysis tools.

## 1. Overview
The Operations station is the "Command Center" for clinic managers and staff. It provides a real-time summary of patient volume, staff performance, and clinical bottlenecks.

## 2. Dashboard Scopes
Admins can toggle between multiple views:
- **Current Clinic**: Real-time data for the clinic the user is currently checked into.
- **Clinic Scope**: Historical and real-time data for any specific clinic.
- **Country Scope**: Aggregated data across all clinics in a specific country (e.g., Bangladesh).
- **Global**: System-wide statistics (reserved for Global Admins).

## 3. Key Performance Indicators (KPIs)
- **Total Patients Today**: Total unique registrations and visits for the current day.
- **Active Queue**: Number of patients currently waiting across all stations.
- **In Consultation**: Number of patients currently being seen by doctors.
- **Completed Visits**: Total patients who have reached the final station (Pharmacy).
- **Average Wait Time**: The mean time a patient spends in the queue today.

## 4. Analytical Panels & Advanced Analytics
- **Patient Flow Funnel**: Visualizes the dropout rate at each clinical station.
- **Clinic Bottleneck Panel**: Identifies which station has the longest average wait or the largest backlog.
- **Wait Time Trend Chart**: D3-powered graph showing wait times over the course of the day.
- **Triage Distribution**: Breakdown of patient acuity (Standard, Urgent, Emergency).
- **Longest Wait List**: Individual tracking of patients who have exceeded wait thresholds (e.g., > 1 hour).
- **Offline Sync Queue (Admin)**: Tracks "Lost" encounters from network blackouts and orphaned un-synced patients that were registered offline.
- **Advanced Analytics Suite (NEW)**: High-level management modules that compute clinical outcomes, NCD cohort tracking, TB Surveillance, Disease Prevalence, Risk Stratifications, and Gemini-driven insights. It aggregates across countries or clinics.

## 5. Technical Requirements
- **Data Source**: Aggregated from `patients`, `encounters`, and `queue` collections.
- **Real-time Engine**: Uses Firestore `onSnapshot` with `where("created_at", ">=", startOfDay)` to ensure live updates without page refreshes.
- **RBAC**: Access restricted to `country_admin`, `global_admin`, or approved clinical staff with a valid clinic assignment.

## 6. Sacred Features & Conservation
1. **Never lose station-specific metrics**: The breakdown for Registration vs. Vitals vs. Doctor vs. Pharmacy must remain distinct.
2. **Preserve Triage Awareness**: The dashboard must prioritize alerts for high-priority (Emergency) patients.
3. **Data Freshness**: Ensure the "Last Updated" timestamp and manual refresh buttons are functional to prevent stale management decisions.
