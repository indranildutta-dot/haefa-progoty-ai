import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { getSession } from "../utils/session";

/**
 * Interface for the detailed dispensing payload.
 * This ensures the backend knows exactly what happened with every pill.
 */
interface DispensePayload {
  medication_id: string;      // The Firestore document ID to subtract from
  medication_name: string;    // Display name for logging
  mode: 'FULL' | 'PARTIAL' | 'OUT_OF_STOCK' | 'SUBSTITUTE';
  qty: number;                // The amount being physically handed over
  substitution?: string | null; // The ID of the generic/alt medicine used
  reason?: string | null;       // Why a substitution or partial was done
  return_on?: string | null;    // IOU date for the patient to get the rest
  is_low_stock?: boolean;       // Trigger for the Requisition system (if < 500)
}

/**
 * Dispense Medication
 * * CRITICAL LOGIC: 
 * This service calls a Cloud Function. The actual subtraction of inventory 
 * happens inside that function using a "Transaction" to ensure that if two 
 * pharmacists dispense the same medicine, the counts stay accurate.
 */
export const dispenseMedication = async (
  clinicId: string, 
  patientId: string, 
  encounterId: string, 
  medications: DispensePayload[]
) => {
  const dispense = httpsCallable(functions, 'dispenseMedication');
  
  // The backend 'dispenseMedication' function handles:
  // 1. Subtracting the 'qty' from clinics/{clinicId}/inventory/{medication_id}
  // 2. Creating a 'dispensing_log' entry for reporting
  // 3. Creating a 'requisition' entry if 'is_low_stock' is true
  const result = await dispense({
    clinicId,
    patientId,
    encounterId,
    medications
  });
  
  return result.data;
};

/**
 * Bulk Inventory Upload
 * * Standardizes the upload process for the Dhaka and other clinics.
 */
import { db } from "../firebase";
import { writeBatch, doc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import ExcelJS from 'exceljs';

export const getInventoryTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventory Template');
  
  sheet.columns = [
    { header: 'medication_id', key: 'name', width: 25 },
    { header: 'batch_id', key: 'batch', width: 15 },
    { header: 'expiry_date', key: 'expiry', width: 15 },
    { header: 'quantity', key: 'qty', width: 10 },
    { header: 'base_unit', key: 'base', width: 12 },
    { header: 'package_unit', key: 'pkg', width: 12 },
    { header: 'dosage', key: 'dosage', width: 15 },
    { header: 'dosage_unit', key: 'unit', width: 15 }
  ];

  sheet.getColumn('expiry').numFmt = 'dd/mm/yyyy';

  sheet.addRow({
    name: 'Example: Paracetamol',
    batch: 'BAT-123',
    expiry: new Date('2027-12-31T00:00:00Z'),
    qty: 500,
    base: 'Tablet',
    pkg: 'Box',
    dosage: '500',
    unit: 'mg'
  });
  
  sheet.addRow({
    name: 'Example: Amoxicillin',
    batch: 'AMOX-456',
    expiry: new Date('2028-06-30T00:00:00Z'),
    qty: 1000,
    base: 'Capsule',
    pkg: 'Bottle',
    dosage: '250',
    unit: 'mg'
  });

  [sheet.getRow(2), sheet.getRow(3)].forEach(row => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }
      };
      cell.font = { bold: true };
    });
  });

  for (let i = 4; i <= 1000; i++) {
    sheet.getCell(`H${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"mg,g,mcg,ml,IU"']
    };
    
    sheet.getCell(`C${i}`).dataValidation = {
      type: 'date',
      operator: 'greaterThan',
      showErrorMessage: true,
      allowBlank: true,
      formulae: [new Date('2000-01-01')],
      showInputMessage: true,
      promptTitle: 'Date Format',
      prompt: 'Enter date as DD/MM/YYYY'
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { fileBase64: btoa(binary) };
};

export const bulkUpload = async (fileBase64: string) => {
  const { selectedClinic } = getSession();
  
  if (!selectedClinic) {
    throw new Error("No clinic selected. Inventory must be tied to a specific clinic location.");
  }

  // Decode the base64 string to a Uint8Array
  const binString = atob(fileBase64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error("Could not find worksheet in the uploaded file.");
  }

  const batch = writeBatch(db);
  const incomingStock = new Map<string, number>();

  let opCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const medId = row.getCell(1).value?.toString().trim() || "";
    const batchId = row.getCell(2).value?.toString().trim() || "";
    
    let expiry_date: Date | null = null;
    const expiryVal = row.getCell(3).value;
    if (expiryVal instanceof Date) {
      expiry_date = expiryVal;
    } else if (typeof expiryVal === 'string') {
      const d = new Date(expiryVal);
      if (!isNaN(d.getTime())) {
        expiry_date = d;
      }
    }
    
    const qty = Number(row.getCell(4).value) || 0;
    const base_unit = row.getCell(5).value?.toString().trim() || "";
    const package_unit = row.getCell(6).value?.toString().trim() || "";
    
    let dosage = row.getCell(7).value?.toString().trim() || "";
    const dosage_unit = row.getCell(8).value?.toString().trim() || "";
    
    if (dosage && dosage_unit) {
      dosage = `${dosage} ${dosage_unit}`;
    } else if (!dosage && dosage_unit) {
      dosage = dosage_unit;
    } else if (!dosage) {
      dosage = "N/A";
    }
    
    if (!medId || medId.toUpperCase().includes('EXAMPLE')) return;
    
    const medLower = medId.toLowerCase().replace(/\s+/g, '');
    incomingStock.set(medLower, (incomingStock.get(medLower) || 0) + qty);

    const docRef = doc(collection(db, `clinics/${selectedClinic.id}/inventory`));
    const payload: any = { 
      medication_id: medId, 
      med_id_lower: medLower, 
      dosage, 
      quantity: qty, 
      created_at: serverTimestamp() 
    };
    if (batchId) payload.batch_id = batchId;
    if (expiry_date) payload.expiry_date = expiry_date;
    if (base_unit) payload.base_unit = base_unit;
    if (package_unit) payload.package_unit = package_unit;
    
    if (opCount < 400) {
      batch.set(docRef, payload);
      opCount++;
    }
  });

  // Automatically reconcile incoming stock with pending requisitions
  const q = query(
    collection(db, "requisitions"),
    where("clinic_id", "==", selectedClinic.id),
    where("status", "in", ["PENDING", "WAITING_FOR_STOCK"])
  );
  const openReqsSnap = await getDocs(q);
  
  const openReqs = openReqsSnap.docs
    .map(d => ({ docSnap: d, data: d.data() }))
    .sort((a, b) => (a.data.created_at?.toMillis() || 0) - (b.data.created_at?.toMillis() || 0));

  for (const { docSnap, data } of openReqs) {
    const medLower = (data.medication_name || "").toLowerCase().replace(/\s+/g, '');
    if (incomingStock.has(medLower)) {
      let remainingStock = incomingStock.get(medLower)!;
      let reqQty = data.required_quantity || 0;
      
      if (remainingStock > 0 && reqQty > 0 && opCount < 500) {
        let fulfilled = Math.min(remainingStock, reqQty);
        let newReqQty = reqQty - fulfilled;
        let newStock = remainingStock - fulfilled;
        
        incomingStock.set(medLower, newStock);
        
        batch.update(docSnap.ref, {
          required_quantity: newReqQty,
          status: newReqQty <= 0 ? 'FULFILLED' : data.status,
          updated_at: serverTimestamp()
        });
        opCount++;
      } else if (remainingStock > 0 && data.type === 'LOW_STOCK_ALERT' && opCount < 500) {
        batch.update(docSnap.ref, {
          status: 'FULFILLED',
          updated_at: serverTimestamp()
        });
        opCount++;
      }
    }
  }

  await batch.commit();
  return { success: true };
};