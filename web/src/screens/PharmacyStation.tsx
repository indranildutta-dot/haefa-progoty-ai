import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Chip, Stack, Card, CardContent, Container, Alert, Divider, Grid,
  IconButton, Tooltip, Tabs, Tab, TextField, ToggleButtonGroup, ToggleButton, CircularProgress, Autocomplete
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InventoryIcon from '@mui/icons-material/Inventory';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, orderBy, limit } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { subscribeToQueue, updateQueueStatus, cancelQueueItem } from '../services/queueService';
import { getPatientById } from '../services/patientService';
import { getOfflineInventory } from '../services/localDataSync';
import { getVitalsByEncounter, saveDispensationProgress } from '../services/encounterService';
import { useAppStore } from '../store/useAppStore';
import SaveIcon from '@mui/icons-material/Save';
import StationLayout from '../components/StationLayout';
import StationSearchHeader from '../components/StationSearchHeader';
import PatientContextBar from '../components/PatientContextBar';
import { useQueueNotifier } from '../hooks/useQueueNotifier'; 
import CancelQueueDialog from '../components/CancelQueueDialog';
import PrintPrescriptionDialog from '../components/PrintPrescriptionDialog';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface InventoryItem {
  id: string;
  medication_id: string;
  dosage: string;
  quantity: number;
  expiry_date?: any;
}

const toDateSafely = (timestamp: any) => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') return new Date(timestamp);
  return null;
};

const toMillisSafely = (timestamp: any) => {
  const d = toDateSafely(timestamp);
  return d ? d.getTime() : 0;
};

const PharmacyStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient, userProfile } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [highlightedPatientIds, setHighlightedPatientIds] = useState<string[]>([]);
  const { newArrivalIds } = useQueueNotifier(waitingList);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [lastEncounterId, setLastEncounterId] = useState<string | null>(null);
  
  // History State
  const [historyFromDate, setHistoryFromDate] = useState<Dayjs | null>(dayjs().subtract(7, 'day'));
  const [historyToDate, setHistoryToDate] = useState<Dayjs | null>(dayjs());
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // Dispensing State
  const [dispensingModes, setDispensingModes] = useState<Record<string, string>>({});
  const [returnDates, setReturnDates] = useState<Record<string, Dayjs | null>>({});
  const [partialQty, setPartialQty] = useState<Record<string, number | ''>>({});
  const [substitutionMeds, setSubstitutionMeds] = useState<Record<string, string | null>>({});
  const [substitutionReasons, setSubstitutionReasons] = useState<Record<string, string>>({});
  const [substitutionDosage, setSubstitutionDosage] = useState<Record<string, string>>({});
  const [substitutionQty, setSubstitutionQty] = useState<Record<string, number | ''>>({});
  
  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  // Procurement State
  const [procurementRecords, setProcurementRecords] = useState<any[]>([]);
  const [isProcurementLoading, setIsProcurementLoading] = useState(false);

  // Checkout State
  const [checkoutList, setCheckoutList] = useState<string[]>([]);

  useEffect(() => {
    setSelectedPatient(null);
    setSelectedItem(null);
    if (!selectedClinic) return;
    return subscribeToQueue(['WAITING_FOR_PHARMACY', 'PHARMACY_IOU'] as any, setWaitingList, (err) => console.error(err));
  }, [selectedClinic, setSelectedPatient]);

  useEffect(() => {
    if (!selectedClinic) return;
    
    setIsInventoryLoading(true);
    
    // First attempt to load fast local cache
    getOfflineInventory(selectedClinic.id).then(localItems => {
        if (localItems && localItems.length > 0) {
            const mapped = localItems.map(doc => ({
                id: doc.id,
                medication_id: doc.medication_id || doc.name || 'Unknown',
                dosage: doc.dosage || '',
                quantity: Number(doc.quantity) || 0,
                category: doc.category || undefined,
                last_restocked: doc.last_restocked || undefined
            })) as InventoryItem[];
            setInventory(prev => prev.length > 0 ? prev : mapped);
            setIsInventoryLoading(false);
        }
    });

    const inventoryRef = collection(db, `clinics/${selectedClinic.id}/inventory`);
    const q = query(inventoryRef, orderBy('medication_id', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if(snapshot.empty) return; // Keep offline cache if nothing loaded
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(items);
      setIsInventoryLoading(false);
    }, (err) => {
      console.error("Inventory error:", err);
      setIsInventoryLoading(false);
    });
    
    return () => unsubscribe();
  }, [selectedClinic]);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const date = toDateSafely(createdAt);
    if (!date) return '0m';
    const totalMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    return totalMinutes < 60 ? `${totalMinutes}m` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  };

  const handleSelectPatient = async (item: any) => {
    try {
      setSelectedItem(item);
      const [patient, medsSnapshot, pastMedsSnapshot] = await Promise.all([
        getPatientById(item.patient_id),
        getDocs(query(collection(db, "prescriptions"), where("encounter_id", "==", item.encounter_id))),
        getDocs(query(collection(db, "prescriptions"), where("patient_id", "==", item.patient_id)))
      ]);
      const vitalsResult = await getVitalsByEncounter(item.encounter_id);
      setPatientVitals(vitalsResult);

      const allMeds: any[] = [];
      
      const globalDispensedDetails = pastMedsSnapshot.docs.reduce((acc: any, doc) => {
        const presData = doc.data() as any;
        if (Array.isArray(presData.dispensation_details)) {
          presData.dispensation_details.forEach((curr: any) => {
            if (!acc[curr.medication]) {
                acc[curr.medication] = { dispensed: 0, modes: [], details: [], lastReturnOn: null };
            }
            acc[curr.medication].dispensed += Number(curr.dispensed) || 0;
            acc[curr.medication].modes.push(curr.mode);
            acc[curr.medication].details.push(curr);
            if (curr.return_on) acc[curr.medication].lastReturnOn = curr.return_on;
          });
        }
        return acc;
      }, {});

      medsSnapshot.forEach(presDoc => {
        const presData = presDoc.data() as any;
        if (Array.isArray(presData.prescriptions)) {
          presData.prescriptions.forEach((med: any, index: number) => {
            const group = globalDispensedDetails[med.medicationName];
            const qtyTotal = Number(med.quantity) || 0;
            const dispensedSoFar = group ? group.dispensed : 0;
            const qtyRemaining = Math.max(0, qtyTotal - dispensedSoFar);
            const isAlreadyFullyDispensed = group ? (group.modes.includes('FULL') || group.modes.includes('SUBSTITUTE') || dispensedSoFar >= qtyTotal) : false;

            allMeds.push({
              ...med,
              id: `${presDoc.id}-${index}`,
              presDocId: presDoc.id,
              originalIndex: index,
              isOwed: false,
              visitDate: toDateSafely(presData.created_at) || new Date(),
              dispensedInfo: group ? group.details : null,
              pharmacistName: presData.dispenser_name,
              pharmacistRegNo: presData.dispenser_reg_no,
              isAlreadyFullyDispensed: isAlreadyFullyDispensed || (presData.status === 'DISPENSED' && !group),
              remainingQuantity: qtyRemaining,
              dispensedSoFar: dispensedSoFar
            });
          });
        }
      });
      
      // Calculate missing/owed meds from previous encounters
      // We'll also track encounter IDs to avoid duplicate information if the user wants to see EXACTLY what was dispensed
      
      const pastPres = pastMedsSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => p.encounter_id !== item.encounter_id)
        .sort((a, b) => toMillisSafely(a.created_at) - toMillisSafely(b.created_at)); // Sort ASC (Oldest first)
        
      for (const pastDoc of pastPres) {
        const visitDate = toDateSafely(pastDoc.created_at) || new Date();

        if (Array.isArray(pastDoc.prescriptions)) {
          for (const originalPres of pastDoc.prescriptions) {
            const group = globalDispensedDetails[originalPres.medicationName];
            const originalQty = Number(originalPres.quantity) || 0;
            const dispensedSoFar = group ? group.dispensed : 0;
            const owedQty = Math.max(0, originalQty - dispensedSoFar);
            
            const isFullyDispensed = group ? (group.modes.includes('FULL') || group.modes.includes('SUBSTITUTE') || dispensedSoFar >= originalQty) : false;

            if (group) {
              if (isFullyDispensed) {
                // Add for information only
                allMeds.push({
                    medicationName: originalPres.medicationName,
                    dosageValue: originalPres.dosageValue || '',
                    dosageUnit: originalPres.dosageUnit || '',
                    instructions: `Fully dispensed on ${visitDate.toLocaleDateString()}`,
                    quantity: originalQty,
                    isOwed: true,
                    id: `past-full-${pastDoc.id}-${originalPres.medicationName.replace(/\s+/g,'-')}`,
                    presDocId: pastDoc.id,
                    originalIndex: -1,
                    visitDate: visitDate,
                    isAlreadyFullyDispensed: true,
                    pharmacistName: pastDoc.dispenser_name,
                    pharmacistRegNo: pastDoc.dispenser_reg_no,
                    dispensedInfo: group.details,
                    remainingQuantity: 0,
                    dispensedSoFar: dispensedSoFar
                  });
              } else if (owedQty > 0) {
                allMeds.push({
                  medicationName: originalPres.medicationName,
                  dosageValue: originalPres.dosageValue || '',
                  dosageUnit: originalPres.dosageUnit || '',
                  instructions: `[PREVIOUSLY OWED from ${visitDate.toLocaleDateString()}] Ordered: ${originalQty}, Dispensed: ${dispensedSoFar}`,
                  quantity: originalQty,
                  promisedDate: group.lastReturnOn, // Capture when they were advised to come back
                  isOwed: true,
                  id: `owed-${pastDoc.id}-${originalPres.medicationName.replace(/\s+/g,'-')}`,
                  presDocId: pastDoc.id,
                  originalIndex: -1,
                  visitDate: visitDate,
                  isAlreadyFullyDispensed: false,
                  dispensedInfo: group.details,
                  remainingQuantity: owedQty,
                  dispensedSoFar: dispensedSoFar
                });
              }
            } else if (pastDoc.status !== 'DISPENSED') {
              // No dispensation info yet for this past encounter record? This shouldn't happen usually for DISPENSED status
              // but let's handle it by showing them as needing dispensing if status is not DISPENSED
              allMeds.push({
                ...originalPres,
                id: `past-pending-${pastDoc.id}-${originalPres.medicationName.replace(/\s+/g,'-')}`,
                presDocId: pastDoc.id,
                originalIndex: -1, // Cannot easily get index from this iteration, but it's okay
                isOwed: true,
                visitDate: visitDate,
                isAlreadyFullyDispensed: false,
                remainingQuantity: originalQty,
                dispensedSoFar: 0,
                dispensedInfo: null
              });
            }
          }
        }
      }

      // Final sort: all meds by visit date ASC
      allMeds.sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime());

      setSelectedPatient({ ...patient, currentVitals: vitalsResult, triage_level: item.triage_level });
      setPrescriptions(allMeds);
      setCheckoutList([]);
      
      // Initialize dispensing modes for each individual medication
      const initialModes: Record<string, string> = {};
      const initialDates: Record<string, Dayjs | null> = {};
      const initialPartialQty: Record<string, number | ''> = {};
      const initialSubMeds: Record<string, string | null> = {};
      const initialSubReasons: Record<string, string> = {};
      const initialSubDosages: Record<string, string> = {};
      const initialSubQty: Record<string, number | ''> = {};
      
      allMeds.forEach(m => {
        initialModes[m.id] = 'FULL';
        initialDates[m.id] = null;
        initialPartialQty[m.id] = '';
        initialSubMeds[m.id] = null;
        initialSubReasons[m.id] = '';
        initialSubDosages[m.id] = '';
        initialSubQty[m.id] = '';
      });
      
      // Modes are initialized to 'FULL' by default in the loop above.
      // If remainingQuantity < quantity, 'FULL' now means 'Full remaining quantity'.
      
      setDispensingModes(initialModes);
      setReturnDates(initialDates);
      setPartialQty(initialPartialQty);
      setSubstitutionMeds(initialSubMeds);
      setSubstitutionReasons(initialSubReasons);
      setSubstitutionDosage(initialSubDosages);
      setSubstitutionQty(initialSubQty);
    } catch (e) { 
      notify("Error loading dispensing data", "error"); 
    }
  };

  const handleSaveProgress = async () => {
    if (!selectedItem) return;
    setIsSavingProgress(true);
    try {
      const medsInCheckout = prescriptions.filter(m => checkoutList.includes(m.id));
      
      const dispensationDetails = medsInCheckout.map(med => {
        const mode = dispensingModes[med.id];
        const remaining = med.remainingQuantity !== undefined ? med.remainingQuantity : med.quantity;
        return {
          medication: med.medicationName,
          mode,
          dispensed: mode === 'PARTIAL' ? Number(partialQty[med.id]) : (mode === 'SUBSTITUTE' ? Number(substitutionQty[med.id]) : Number(remaining)),
          return_on: (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') ? returnDates[med.id]?.toISOString() : null,
          created_at: new Date()
        };
      });

      await saveDispensationProgress(selectedItem.encounter_id, dispensationDetails);
      await updateQueueStatus(selectedItem.id, selectedItem.status, true);
      
      notify("Progress saved. Patient remains in pharmacy queue.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (error: any) {
      notify(`Failed to save progress: ${error.message}`, "error");
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleFinalize = async () => {
    // Validation
    for (const med of prescriptions) {
      const mode = dispensingModes[med.id];
      if (mode === 'SUBSTITUTE') {
        if (!substitutionMeds[med.id] || !substitutionReasons[med.id] || !substitutionQty[med.id]) {
          return notify(`Please provide substitute medication, quantity, and reason for ${med.medicationName}`, "warning");
        }
      }
      if (mode === 'PARTIAL') {
        if (!partialQty[med.id]) {
          return notify(`Please specify how many units were dispensed for partial fulfilment of ${med.medicationName}`, "warning");
        }
      }
      if ((mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') && !returnDates[med.id]) {
        return notify(`Please provide a return date for ${med.medicationName}`, "warning");
      }
    }

    setIsFinalizing(true);
    try {
      const dispense = httpsCallable(functions, 'dispenseMedication');
      
      const medsInCheckout = prescriptions.filter(m => checkoutList.includes(m.id));
      
      const medsToDispense = medsInCheckout.map(med => {
        const mode = dispensingModes[med.id];
        let inventoryId: string | undefined = undefined;

        if (mode === 'SUBSTITUTE') {
          inventoryId = substitutionMeds[med.id] || undefined;
        } else if (mode === 'FULL' || mode === 'PARTIAL') {
          // Priority 1: Use medicationId directly from Doctor's selection in PrescriptionBuilder
          inventoryId = med.medicationId;
          
          // Priority 2: Fallback to matching medication name in inventory (for older or custom entries)
          if (!inventoryId) {
            const medNameLower = med.medicationName.toLowerCase().replace(/\s+/g, '');
            const match = inventory.find(i => i.medication_id.toLowerCase().replace(/\s+/g, '') === medNameLower);
            inventoryId = match?.id;
          }
        }

        return {
          medication_name: med.medicationName,
          mode,
          qty: mode === 'SUBSTITUTE' && substitutionQty[med.id] ? Number(substitutionQty[med.id]) : (mode === 'PARTIAL' && partialQty[med.id] ? Number(partialQty[med.id]) : (med.remainingQuantity !== undefined ? med.remainingQuantity : med.quantity)),
          prescribed_qty: med.remainingQuantity !== undefined ? med.remainingQuantity : (Number(med.quantity) || 0),
          inventoryId,
          presDocId: med.presDocId,
          substitution: mode === 'SUBSTITUTE' ? inventory.find(i => i.id === substitutionMeds[med.id])?.medication_id : null,
          substitution_reason: mode === 'SUBSTITUTE' ? substitutionReasons[med.id] : null,
          return_on: (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') 
            ? returnDates[med.id]?.toISOString() 
            : null
        };
      });

      await dispense({
        clinicId: selectedClinic?.id,
        encounterId: selectedItem.encounter_id,
        patientId: selectedItem.patient_id,
        medications: medsToDispense
      });

      setLastEncounterId(selectedItem.encounter_id);
      setShowPrintDialog(true);

      notify("Patient visit finalized. Medications dispensed.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e: any) { 
      console.error("Dispensing error completely captured:", e);
      notify(`Error finalizing dispensing session: ${e.message}`, "error"); 
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const getTemplate = httpsCallable(functions, 'getInventoryTemplate');
      const result = await getTemplate();
      const { fileBase64 } = result.data as any;
      
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${fileBase64}`;
      link.download = 'Inventory_Template.xlsx';
      link.click();
      notify("Template downloaded", "success");
    } catch (err) {
      notify("Error downloading template", "error");
    }
  };

  const fetchDispensingHistory = async () => {
    if (!selectedClinic || !historyFromDate || !historyToDate) return;
    
    setIsHistoryLoading(true);
    setHistoryRecords([]);
    
    try {
      const start = historyFromDate.startOf('day').toDate();
      const end = historyToDate.endOf('day').toDate();
      
      // Query prescriptions that have been updated within the date range
      const q = query(
        collection(db, "prescriptions"),
        where("updated_at", ">=", start),
        where("updated_at", "<=", end)
      );
      
      const snapshot = await getDocs(q);
      const records: any[] = [];
      
      for (const d of snapshot.docs) {
        const data = d.data();
        
        // Include both full and partial dispensations
        if (data.status !== 'DISPENSED' && data.status !== 'PARTIAL_DISPENSED') continue;
        
        // Since we need to show patient name, we need to fetch the patient or use existing data if available
        let patientName = "Unknown";
        try {
            const pData = await getPatientById(data.patient_id);
            if (pData) {
                patientName = `${pData.given_name} ${pData.family_name}`;
            }
        } catch(e) {
            console.error("Could not fetch patient name for history", e);
        }

        if (data.dispensation_details && Array.isArray(data.dispensation_details)) {
          data.dispensation_details.forEach((detail: any, index: number) => {
             // Only include dispensation details that happened in the selected date range
             const detailDate = toDateSafely(detail.created_at) || toDateSafely(data.updated_at);
             if (!detailDate || detailDate < start || detailDate > end) return;
             
             records.push({
               ...detail,
               id: `${d.id}-${index}`,
               date: detailDate,
               patientName,
               pharmacist: data.dispenser_name,
               encounterId: data.encounter_id
             });
          });
        }
      }
      
      // Sort in memory by date descending
      records.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setHistoryRecords(records);
    } catch (err) {
      console.error("Error fetching dispensing history", err);
      notify("Failed to fetch dispensing history", "error");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const repairLostTimestamps = async () => {
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("status", "==", "DISPENSED")
      );
      const snapshot = await getDocs(q);
      let count = 0;
      for (const d of snapshot.docs) {
        const data = d.data();
        const isBad = !data.updated_at || (typeof data.updated_at === 'object' && Object.keys(data.updated_at).length === 0);
        if (isBad) {
            await updateDoc(doc(db, "prescriptions", d.id), {
                updated_at: serverTimestamp()
            });
            count++;
        }
      }
      if (count > 0) {
        notify(`Repaired ${count} missing timestamps. You can now search!`, "success");
      } else {
        notify(`No missing timestamps found.`, "info");
      }
    } catch (err) {
      console.error("Repair failed", err);
      notify("Failed to repair timestamps", "error");
    }
  };

  const fetchProcurementReport = async () => {
    if (!selectedClinic) return;
    setIsProcurementLoading(true);
    try {
      const qRef = query(collection(db, "requisitions"), where("clinic_id", "==", selectedClinic.id));
      const snapshot = await getDocs(qRef);
      // Filter out FULFILLED records to keep the report clean, or show everything
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.status !== 'FULFILLED');
      records.sort((a: any, b: any) => toMillisSafely(b.created_at) - toMillisSafely(a.created_at));
      setProcurementRecords(records);
    } catch (e) {
      console.error("Error fetching requisitions:", e);
      notify("Error loading procurement report", "error");
    } finally {
      setIsProcurementLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 3 && procurementRecords.length === 0) {
      fetchProcurementReport();
    }
  }, [activeTab, selectedClinic]);

  const handleDownloadExcel = () => {
    if (!procurementRecords.length) return;
    
    const formattedData = procurementRecords.map(r => ({
      'Date': r.created_at ? dayjs(toDateSafely(r.created_at)).format('DD/MM/YYYY HH:mm') : 'N/A',
      'Medication Name': r.medication_name || 'Unknown',
      'Requirement Type': r.type === 'LOW_STOCK_ALERT' ? 'Low Stock Warning' : 
                          r.type === 'PATIENT_IOU_SHORTFALL' ? 'Patient Dispense Shortfall (IOU)' : 
                          'Procurement Needed / New Med',
      'Quantity Needed': r.required_quantity || 'N/A',
      'Status': r.status || '',
      'Current Stock Configured': r.current_stock || 0,
      'Associated Patient ID': r.patient_id || 'N/A',
      'Encounter ID': r.encounter_id || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Procurement_Needs");
    
    // Generate Excel file using xlsx package
    XLSX.writeFile(workbook, `Procurement_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClinic) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        const upload = httpsCallable(functions, 'bulkUpload');
        await upload({ clinicId: selectedClinic.id, fileBase64: base64 });
        notify("Inventory uploaded successfully", "success");
        // Reset input
        event.target.value = '';
      } catch (err) {
        console.error("Upload error:", err);
        notify("Error uploading inventory", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReprintFromSearch = async (patientId: string) => {
    try {
      // Find the most recent prescription for this patient that has actual prescriptions or dispensations
      const q = query(
        collection(db, "prescriptions"),
        where("patient_id", "==", patientId),
        orderBy("created_at", "desc"),
        limit(10) // fetch a few to ensure we find one with data
      );
      const snapshot = await getDocs(q);
      
      let targetEncounterId = null;
      for (const d of snapshot.docs) {
        const data = d.data();
        if ((data.prescriptions && data.prescriptions.length > 0) || (data.dispensation_details && data.dispensation_details.length > 0)) {
            targetEncounterId = data.encounter_id;
            break;
        }
      }
      
      // Fallback to the absolute latest prescription even if empty
      if (!targetEncounterId && !snapshot.empty) {
        targetEncounterId = snapshot.docs[0].data().encounter_id;
      }
      
      if (targetEncounterId) {
        setLastEncounterId(targetEncounterId);
        setShowPrintDialog(true);
      } else {
        notify("No prescriptions found for this patient", "warning");
      }
    } catch (err) {
      console.error("Reprint error:", err);
      notify("Error finding latest prescription", "error");
    }
  };

  const handleCancelQueueItem = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await cancelQueueItem(cancelTarget.id!, reason);
      notify(`Visit cancelled for ${cancelTarget.patient_name}`, 'info');
      setCancelTarget(null);
    } catch (err) {
      console.error("Cancel Error:", err);
      notify("Failed to cancel visit", "error");
    }
  };

  const renderDispensingView = () => (
    <Box>
      {!selectedItem ? (
        <Box>
          <StationSearchHeader 
            stationStatus="WAITING_FOR_PHARMACY"
            onPatientFound={(p, item) => item ? handleSelectPatient(item) : null}
            waitingList={waitingList}
            highlightedPatientIds={highlightedPatientIds}
            setHighlightedPatientIds={setHighlightedPatientIds}
            onReprint={handleReprintFromSearch}
          />

          <TableContainer component={Paper} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Wait Time</TableCell>
                  <TableCell>Patient Name</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {waitingList.map(item => {
                  const isHighlighted = highlightedPatientIds.includes(item.patient_id as string);
                  const isNew = newArrivalIds.includes(item.id as string);
                  return (
                    <TableRow 
                      key={item.id} 
                      hover
                      sx={{ 
                        bgcolor: isHighlighted ? '#fef9c3' : isNew ? '#dcfce7' : 'inherit',
                        transition: 'background-color 0.5s ease',
                        borderLeft: isHighlighted ? '6px solid #facc15' : isNew ? '6px solid #22c55e' : 'none'
                      }}
                    >
                      <TableCell>{formatWaitTime(item.station_entry_at || item.created_at)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight="bold">{item.patient_name}</Typography>
                          {item.status === 'PHARMACY_IOU' && (
                            <Chip label="IOU PENDING" size="small" color="warning" sx={{ fontWeight: 900, height: 20 }} />
                          )}
                          {isHighlighted && (
                            <Chip label="MATCH" size="small" color="warning" sx={{ ml: 1, fontWeight: 900, height: 20 }} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="Cancel Visit">
                            <IconButton 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelTarget(item);
                              }}
                              sx={{ mr: 1 }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          <Button 
                            variant="contained" 
                            color={isHighlighted ? "warning" : "primary"}
                            onClick={() => handleSelectPatient(item)}
                          >
                            Dispense Meds
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {waitingList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No prescriptions pending in queue.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <Container maxWidth="lg">
            <Stack spacing={2} sx={{ mb: 4 }}>
                {(() => {
                  const hasAllergies = patientVitals?.allergies && (
                    Array.isArray(patientVitals.allergies) 
                      ? patientVitals.allergies.some(a => String(a).trim().toLowerCase() !== 'none')
                      : String(patientVitals.allergies).trim().toLowerCase() !== 'none' && String(patientVitals.allergies).trim() !== ''
                  );
                  if (hasAllergies) {
                    return (
                      <Alert severity="error" variant="filled" icon={<WarningIcon />}>
                        <strong>CRITICAL ALLERGY ALERT:</strong> {Array.isArray(patientVitals.allergies) ? patientVitals.allergies.join(', ') : patientVitals.allergies}
                      </Alert>
                    );
                  }
                  return null;
                })()}
                {patientVitals?.is_pregnant && (
                  <Alert severity="warning" variant="filled" icon={<ErrorIcon />}>
                    <strong>PREGNANCY ALERT:</strong> Patient is {patientVitals.pregnancy_months} months pregnant. Check drug safety.
                  </Alert>
                )}
            </Stack>

            <Paper sx={{ p: 4, borderRadius: 5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="900">Dispensary Verification</Typography>
                <Button variant="outlined" onClick={() => {
                  setSelectedItem(null);
                  setSelectedPatient(null);
                }}>Back to Queue</Button>
              </Stack>
              
              <Stack spacing={3}>
                {prescriptions.map((med, idx) => {
                  const isAlreadyDispensed = med.isAlreadyFullyDispensed;
                  // IMPROVED NEW MED DETECTION: Check if explicitly marked OR if missing from currently loaded inventory
                  const inInventory = inventory.some(i => i.medication_id.toLowerCase().replace(/\s+/g, '') === med.medicationName.toLowerCase().replace(/\s+/g, ''));
                  const isNewMed = med.isRequisition || (!inInventory && !isAlreadyDispensed);
                  const currentMode = dispensingModes[med.id] || 'FULL';
                  const isInCheckout = checkoutList.includes(med.id);

                  return (
                    <Card key={idx} variant="outlined" sx={{ 
                      borderRadius: 4, 
                      border: isInCheckout ? '2px solid #3b82f6' : (isAlreadyDispensed ? '1px dashed #cbd5e1' : '1px solid #e2e8f0'),
                      bgcolor: isAlreadyDispensed ? '#f8fafc' : 'white',
                      opacity: isAlreadyDispensed ? 0.7 : 1,
                      position: 'relative'
                    }}>
                      <CardContent>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                              <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Visit Date: {med.visitDate ? dayjs(med.visitDate).format('DD/MM/YYYY') : 'N/A'}
                              </Typography>
                              {med.isOwed && <Chip label="OWED" size="small" color="warning" sx={{ height: 16, fontSize: '0.65rem', fontWeight: 900 }} />}
                              {isNewMed && <Chip label="NOT IN MEDICINE INVENTORY" size="small" color="secondary" sx={{ height: 16, fontSize: '0.65rem', fontWeight: 900 }} />}
                              {isInCheckout && <Chip label="IN CHECKOUT" size="small" color="primary" icon={<ShoppingCartIcon sx={{ fontSize: '10px !important' }} />} sx={{ height: 16, fontSize: '0.65rem', fontWeight: 900 }} />}
                            </Stack>
                            
                            <Box sx={{ 
                              bgcolor: isNewMed ? '#e2e8f0' : 'transparent', 
                              px: isNewMed ? 1.5 : 0, 
                              py: isNewMed ? 0.75 : 0, 
                              borderRadius: 2, 
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              border: isNewMed ? '1px solid #cbd5e1' : 'none'
                            }}>
                              <Typography variant="h6" color={isAlreadyDispensed ? "text.secondary" : (isNewMed ? "#1e293b" : "primary")} fontWeight="900">
                                {med.medicationName || "Unspecified"}
                              </Typography>
                              {!isAlreadyDispensed && med.remainingQuantity !== undefined && med.remainingQuantity < med.quantity && (
                                <Chip label="IOU - PARTIAL" size="small" color="warning" sx={{ fontWeight: 'bold' }} />
                              )}
                            </Box>
                            
                            <Typography variant="body1" fontWeight="700" sx={{ color: isAlreadyDispensed ? 'text.secondary' : 'inherit', mt: 0.5 }}>
                              {med.dosageValue}{med.dosageUnit} x {med.remainingQuantity !== undefined && med.remainingQuantity < med.quantity ? `${med.remainingQuantity} Remaining (from ${med.quantity} Total)` : `${med.quantity} Total`}
                            </Typography>
                            
                            {med.dispensedInfo && Array.isArray(med.dispensedInfo) && med.dispensedInfo.length > 0 && (
                              <Box sx={{ mt: 1, mb: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #cbd5e1' }}>
                                <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
                                  Dispensing History:
                                </Typography>
                                <Stack spacing={0.5}>
                                  {med.dispensedInfo.map((disp: any, i: number) => (
                                    <Typography key={i} variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                                      <span>Mode: <strong>{disp.mode}</strong> (Qty: {disp.dispensed || 0})</span>
                                      <span>{disp.created_at ? dayjs(toDateSafely(disp.created_at)).format('DD/MM/YYYY HH:mm') : ''}</span>
                                    </Typography>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {med.promisedDate && (
                              <Box sx={{ mt: 1, p: 1, bgcolor: '#fff7ed', borderRadius: 1.5, border: '1px solid #ffedd5' }}>
                                <Typography variant="caption" color="#9a3412" fontWeight="bold">
                                  ADVISED RETURN DATE: {dayjs(med.promisedDate).format('DD/MM/YYYY')}
                                </Typography>
                              </Box>
                            )}

                            {med.instructions && (
                              <Box sx={{ mt: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 2, borderLeft: '4px solid #3b82f6' }}>
                                  <Typography variant="caption" fontWeight="900" color="#1e40af" sx={{ textTransform: 'uppercase' }}>
                                    {med.isOwed ? "Pharmacist's Note:" : "Doctor's Notes:"}
                                  </Typography>
                                  <Typography variant="body2">{med.instructions}</Typography>
                              </Box>
                            )}
                            
                            {!isAlreadyDispensed && (
                              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #e0f2fe' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                                  Assigned to: <strong>{userProfile?.name}</strong> ({userProfile?.professional_body || 'PCB'}: {userProfile?.professional_reg_no || 'PENDING'})
                                </Typography>
                              </Box>
                            )}
                            
                            {isAlreadyDispensed && (
                              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f1f5f9', borderRadius: 2, border: '1px solid #cbd5e1' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                                  Processed By: <strong>{med.pharmacistName}</strong> ({med.pharmacistRegNo})
                                </Typography>
                              </Box>
                            )}
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ color: isAlreadyDispensed ? 'text.disabled' : 'inherit' }}>Dispensing Mode:</Typography>
                            <ToggleButtonGroup
                              value={currentMode}
                              exclusive
                              onChange={(_, val) => val && setDispensingModes(prev => ({ ...prev, [med.id]: val }))}
                              fullWidth
                              color="primary"
                              sx={{ mb: 2 }}
                              disabled={isAlreadyDispensed || isInCheckout}
                            >
                              <ToggleButton value="FULL" sx={{ py: 1.5 }} disabled={isNewMed}>FULL</ToggleButton>
                              <ToggleButton value="PARTIAL" sx={{ py: 1.5 }} disabled={isNewMed}>PARTIAL</ToggleButton>
                              <ToggleButton value="OUT_OF_STOCK" sx={{ py: 1.5 }}>OOS</ToggleButton>
                              <ToggleButton value="SUBSTITUTE" sx={{ py: 1.5 }}>SUB</ToggleButton>
                            </ToggleButtonGroup>

                          {isAlreadyDispensed ? (
                             <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                               <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">Item is fully dispensed</Typography>
                               <Typography variant="caption" color="text.secondary">No further dispensing is required for this medication.</Typography>
                             </Box>
                          ) : (
                           <>
                            {(currentMode === 'PARTIAL' || currentMode === 'OUT_OF_STOCK') && (
                              <Box sx={{ mt: 2 }}>
                                <Stack spacing={2}>
                                  {currentMode === 'PARTIAL' && (
                                    <TextField 
                                      label="Quantity Dispensed"
                                      type="number"
                                      required
                                      value={partialQty[med.id] || ''}
                                      onChange={(e) => setPartialQty(prev => ({ ...prev, [med.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                    />
                                  )}
                                    <DatePicker
                                      label="Return Date for IOU"
                                      value={returnDates[med.id]}
                                      onChange={(val) => setReturnDates(prev => ({ ...prev, [med.id]: val }))}
                                      slotProps={{ textField: { fullWidth: true } }}
                                      minDate={dayjs()}
                                    />
                                </Stack>
                              </Box>
                            )}

                            {currentMode === 'SUBSTITUTE' && (
                              <Stack spacing={2} sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="subtitle2" fontWeight="800" color="primary">Substitute Medication Details</Typography>
                                <Autocomplete
                                  options={inventory.filter(i => i.quantity > 0)}
                                  getOptionLabel={(option) => `${option.medication_id} (${option.dosage}) - Stock: ${option.quantity}`}
                                  value={inventory.find(i => i.id === substitutionMeds[med.id]) || null}
                                  onChange={(_, newValue) => {
                                    setSubstitutionMeds(prev => ({ ...prev, [med.id]: newValue ? newValue.id : null }));
                                    if (newValue) {
                                      setSubstitutionDosage(prev => ({ ...prev, [med.id]: newValue.dosage || '' }));
                                    } else {
                                      setSubstitutionDosage(prev => ({ ...prev, [med.id]: '' }));
                                    }
                                  }}
                                  renderInput={(params) => <TextField {...params} label="Select Substitute from Inventory" size="small" required />}
                                />
                                <Stack direction="row" spacing={2}>
                                  <TextField
                                    label="Dosage"
                                    size="small"
                                    value={substitutionDosage[med.id] || ''}
                                    fullWidth
                                    disabled
                                  />
                                  <TextField
                                    label="Dispensing Qty"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={substitutionQty[med.id] || ''}
                                    onChange={(e) => setSubstitutionQty(prev => ({ ...prev, [med.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                    required
                                  />
                                </Stack>
                                <TextField
                                  label="Reason for Substitution"
                                  fullWidth
                                  size="small"
                                  required
                                  multiline
                                  rows={2}
                                  value={substitutionReasons[med.id] || ''}
                                  onChange={(e) => setSubstitutionReasons(prev => ({ ...prev, [med.id]: e.target.value }))}
                                />
                              </Stack>
                            )}
                           </>
                          )}

                          {!isAlreadyDispensed && (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                              <Button
                                size="large"
                                variant={isInCheckout ? "outlined" : "contained"}
                                color={isInCheckout ? "error" : "primary"}
                                startIcon={isInCheckout ? <CancelIcon /> : <ShoppingCartIcon />}
                                onClick={() => {
                                  if (isInCheckout) {
                                    setCheckoutList(prev => prev.filter(id => id !== med.id));
                                  } else {
                                    setCheckoutList(prev => [...prev, med.id]);
                                  }
                                }}
                                sx={{ borderRadius: 2, px: 4, fontWeight: 900 }}
                              >
                                {isInCheckout ? "REMOVE FROM CHECKOUT" : "ADD TO CHECKOUT"}
                              </Button>
                            </Box>
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )})}
              </Stack>
              
              <Divider sx={{ my: 4 }} />
              
              <Box sx={{ mt: 8, pt: 4, borderTop: '2px dashed #e2e8f0' }}>
                {checkoutList.length > 0 && (
                  <Alert severity="info" sx={{ mb: 4, borderRadius: 3, '& .MuiAlert-message': { width: '100%' } }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight="bold">
                          Checkout Summary: {checkoutList.length} item(s) selected
                        </Typography>
                        <Button size="small" color="primary" variant="outlined" onClick={() => setCheckoutList([])}>
                          Clear All
                        </Button>
                      </Stack>
                      
                      <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Medication</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Dosage</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Mode</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                              <TableCell align="right"></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {prescriptions.filter(m => checkoutList.includes(m.id)).map(med => {
                              const mode = dispensingModes[med.id];
                              const qty = mode === 'PARTIAL' ? partialQty[med.id] : 
                                          mode === 'SUBSTITUTE' ? substitutionQty[med.id] : 
                                          (med.remainingQuantity !== undefined ? med.remainingQuantity : med.quantity);
                              return (
                                <TableRow key={med.id}>
                                  <TableCell>{med.medicationName}</TableCell>
                                  <TableCell>{med.dosageValue}{med.dosageUnit}</TableCell>
                                  <TableCell>
                                    <Chip label={mode} size="small" color={mode === 'FULL' ? 'success' : 'warning'} variant="outlined" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>{qty}</TableCell>
                                  <TableCell align="right">
                                    <IconButton size="small" color="error" onClick={() => setCheckoutList(prev => prev.filter(id => id !== med.id))}>
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Stack>
                  </Alert>
                )}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Button 
                      fullWidth variant="outlined" color="inherit" size="large" 
                      onClick={() => setSelectedItem(null)}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                    >
                      Cancel
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Button 
                      fullWidth variant="outlined" color="primary" size="large" 
                      startIcon={<SaveIcon />}
                      onClick={handleSaveProgress}
                      disabled={isFinalizing || isSavingProgress || checkoutList.length === 0}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                    >
                      {isSavingProgress ? <CircularProgress size={24} /> : "Save Progress"}
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      color={prescriptions.filter(m => checkoutList.includes(m.id)).some(med => dispensingModes[med.id] === 'PARTIAL' || dispensingModes[med.id] === 'OUT_OF_STOCK') ? "warning" : "primary"} 
                      size="large" 
                      onClick={handleFinalize}
                      disabled={isFinalizing || checkoutList.length === 0}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 900 }}
                    >
                      {isFinalizing ? <CircularProgress size={24} color="inherit" /> : (
                        prescriptions.filter(m => checkoutList.includes(m.id)).some(med => dispensingModes[med.id] === 'PARTIAL' || dispensingModes[med.id] === 'OUT_OF_STOCK') 
                        ? `FINALIZE WITH IOU (${checkoutList.length})` 
                        : `FINALIZE & DISPENSE (${checkoutList.length})`
                      )}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Container>
        </Box>
      )}
    </Box>
  );

  const renderInventoryView = () => (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="flex-end" mb={3}>
        <Button 
          variant="outlined" 
          startIcon={<DownloadIcon />} 
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
        <Button 
          variant="contained" 
          component="label" 
          startIcon={<UploadFileIcon />}
        >
          Bulk Upload
          <input type="file" hidden accept=".xlsx" onChange={handleBulkUpload} />
        </Button>
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Medication Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Dosage</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Current Stock</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Expiry Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isInventoryLoading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : inventory.length > 0 ? (
              inventory.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.medication_id}</TableCell>
                  <TableCell>{item.dosage}</TableCell>
                  <TableCell>
                    <Chip 
                      label={item.quantity} 
                      color={item.quantity < 50 ? "error" : item.quantity < 200 ? "warning" : "success"}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>
                    {item.expiry_date ? (
                      toDateSafely(item.expiry_date) ? dayjs(toDateSafely(item.expiry_date)).format('DD/MM/YYYY') : 'N/A'
                    ) : 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">No inventory records found for this clinic.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderHistoryView = () => (
    <Box>
      <Paper sx={{ p: 3, mb: 4, borderRadius: 4 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="From Date"
                value={historyFromDate}
                onChange={(val) => setHistoryFromDate(val)}
                slotProps={{ textField: { fullWidth: true } }}
                maxDate={historyToDate || dayjs()}
              />
            </LocalizationProvider>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="To Date"
                value={historyToDate}
                onChange={(val) => setHistoryToDate(val)}
                slotProps={{ textField: { fullWidth: true } }}
                minDate={historyFromDate || undefined}
                maxDate={dayjs()}
              />
            </LocalizationProvider>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<SearchIcon />}
                onClick={fetchDispensingHistory}
                disabled={isHistoryLoading || !historyFromDate || !historyToDate}
                sx={{ height: 56, flex: 1, fontWeight: 700 }}
              >
                Search History
              </Button>
              <Tooltip title="If records from before to this update are missing, click this to repair their invisible timestamps.">
                <Button 
                  variant="outlined" 
                  color="warning"
                  onClick={repairLostTimestamps}
                  sx={{ height: 56, minWidth: '40px' }}
                >
                  <WarningIcon />
                </Button>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Medication</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Dispensing Mode</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Qty Dispensed</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Pharmacist</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isHistoryLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : historyRecords.length > 0 ? (
              historyRecords.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    {item.date ? dayjs(item.date).format('DD/MM/YYYY HH:mm') : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{item.patientName}</TableCell>
                  <TableCell>
                    {item.medication}
                    {item.substitution && <Typography variant="caption" display="block" color="text.secondary">Sub for: {item.substitution}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.mode} 
                      size="small" 
                      color={item.mode === 'FULL' ? 'success' : item.mode === 'OUT_OF_STOCK' ? 'error' : 'warning'} 
                      sx={{ fontWeight: 'bold', height: 24 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.dispensed || 0}</TableCell>
                  <TableCell>{item.pharmacist || 'Unknown'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">
                    {historyRecords.length === 0 && !isHistoryLoading 
                      ? "Search a date range to view dispensing history." 
                      : "No records found for this period."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderProcurementReport = () => (
    <Box>
      <Paper sx={{ p: 4, mb: 4, borderRadius: 5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
             <Typography variant="h6" fontWeight="bold">Procurement & Over-prescribed Report</Typography>
             <Typography variant="body2" color="text.secondary" mt={0.5}>
               Tracks medicines that are low on stock, missing, or newly prescribed by doctors outside the existing inventory catalog.
             </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              onClick={fetchProcurementReport}
              disabled={isProcurementLoading}
            >
              Refresh
            </Button>
            <Button 
              variant="contained" 
              color="success"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadExcel}
              disabled={procurementRecords.length === 0 || isProcurementLoading}
            >
              Download .xlsx
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Medication</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Deficit Qty</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Linked Patient</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isProcurementLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : procurementRecords.length > 0 ? (
              procurementRecords.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    {item.created_at ? dayjs(toDateSafely(item.created_at)).format('DD/MM/YY HH:mm') : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{item.medication_name || 'Unknown'}</TableCell>
                  <TableCell>
                     <Chip 
                        size="small"
                        label={
                          item.type === 'LOW_STOCK_ALERT' ? 'Low Stock' : 
                          item.type === 'PATIENT_IOU_SHORTFALL' ? 'Patient Shortfall' : 
                          'Procurement Needed'
                        }
                        color={
                          item.type === 'LOW_STOCK_ALERT' ? 'warning' : 
                          item.type === 'PATIENT_IOU_SHORTFALL' ? 'error' : 
                          'info'
                        }
                     />
                  </TableCell>
                  <TableCell align="center">
                    <Typography fontWeight="bold" color="error">{item.required_quantity || '-'}</Typography>
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {item.patient_id ? (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{item.patient_id.substring(0,8)}...</Typography>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">No open procurement requisitions found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <StationLayout title="Pharmacy & Inventory" stationName="Pharmacy" showPatientContext={!!selectedItem}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {!selectedItem && (
          <Box sx={{ mb: 4 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, val) => setActiveTab(val)} 
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab icon={<LocalPharmacyIcon />} label="Dispensing Queue" iconPosition="start" />
              <Tab icon={<InventoryIcon />} label="Medicine Inventory" iconPosition="start" />
              <Tab icon={<HistoryIcon />} label="Dispensing History" iconPosition="start" />
              <Tab icon={<ShoppingCartIcon />} label="Procurement Report" iconPosition="start" />
            </Tabs>
          </Box>
        )}

        {activeTab === 0 ? renderDispensingView() : activeTab === 1 ? renderInventoryView() : activeTab === 2 ? renderHistoryView() : renderProcurementReport()}
      </Container>

      <CancelQueueDialog 
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelQueueItem}
        patientName={cancelTarget?.patient_name || ''}
      />
      {lastEncounterId && (
        <PrintPrescriptionDialog 
          open={showPrintDialog} 
          onClose={() => setShowPrintDialog(false)} 
          encounterId={lastEncounterId} 
        />
      )}
    </StationLayout>
    </LocalizationProvider>
  );
};

export default PharmacyStation;
