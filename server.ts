import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import dotenv from "dotenv";

import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin with a robust fallback for projectId
if (!getApps().length) {
  let projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    try {
      const pathsToTry = [
        path.join(process.cwd(), "firebase-applet-config.json"),
        path.join(process.cwd(), "web", "firebase-applet-config.json"),
        path.join(__dirname, "firebase-applet-config.json"),
        path.join(__dirname, "..", "firebase-applet-config.json"),
      ];
      for (const configPath of pathsToTry) {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          projectId = config.projectId;
          break;
        }
      }
    } catch (err) {
      console.error("Failed to read firebase-applet-config.json for Admin fallback:", err);
    }
  }
  initializeApp({
    projectId: projectId || "haefa-progoty-dev",
  });
}

const db = getFirestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  };

  const sanitizeData = (data: any) => {
    if (!data || typeof data !== 'object') return {};
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined && value !== null) {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ICD-11 Token Proxy
  let cachedIcdToken: { token: string; expiry: number } | null = null;
  app.get("/api/icd/token", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedIcdToken && cachedIcdToken.expiry > now + 120000) {
        return res.json({ access_token: cachedIcdToken.token });
      }

      const clientId = process.env.WHO_CLIENT_ID;
      const clientSecret = process.env.WHO_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("WHO ICD-11 credentials missing in server environment");
        return res.status(500).json({ error: "ICD-11 credentials not configured" });
      }

      const response = await fetch("https://icdaccessmanagement.who.int/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "icdapi_access",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("WHO Token Error:", errorText);
        return res.status(response.status).json({ error: "Failed to fetch WHO token" });
      }

      const data: any = await response.json();
      cachedIcdToken = {
        token: data.access_token,
        expiry: now + (data.expires_in * 1000),
      };

      res.json({ access_token: data.access_token });
    } catch (error: any) {
      console.error("ICD Token Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Local Excel Template Generator (Express fallback/bypass for functions)
  app.get("/api/pharmacy/get-template", async (req, res) => {
    try {
      const exceljs = await import("exceljs");
      const Workbook = exceljs.Workbook || (exceljs as any).default?.Workbook;
      if (!Workbook) {
        return res.status(500).json({ error: "ExcelJS.Workbook is undefined" });
      }
      const workbook = new Workbook();
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

      // Set date format DD/MM/YYYY for the expiry column
      sheet.getColumn('expiry').numFmt = 'dd/mm/yyyy';

      // Add guidance/instruction row (Row 2) - to be ignored by parsing
      sheet.addRow({
        name: 'Save completed file in format - Country-Clinic-Date.xlsx    Example: Bangladesh-Dhaka-June 22nd.xlsx'
      });
      sheet.mergeCells('A2:H2');

      // Add examples (Rows 3 and 4)
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

      // Make rows 2, 3 and 4 orange/yellow
      [sheet.getRow(2), sheet.getRow(3), sheet.getRow(4)].forEach(row => {
        row.eachCell((cell: any) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC000' } // Orange
          };
          cell.font = { bold: true };
        });
      });

      // Specifically make cell A2 (the merged cell for guideline) red and bold font
      const guidanceCell = sheet.getCell('A2');
      guidanceCell.font = {
        bold: true,
        color: { argb: 'FFFF0000' } // Red (FF0000)
      };

      // Add Data Validation starting from row 5
      for (let i = 5; i <= 1000; i++) {
        // Dosage Unit dropdown (Column H)
        sheet.getCell(`H${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"mg,g,mcg,ml,IU"']
        };

        // Base Unit dropdown (Column E)
        sheet.getCell(`E${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Tablet,Capsule,Bottle"']
        };

        // Package Unit dropdown (Column F)
        sheet.getCell(`F${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Box,Bottle,Carton,Pack,Strip,Tube,Vial,Case,Piece,Sachet"']
        };
        
        // Expiry Date hint
        sheet.getCell(`C${i}`).dataValidation = {
          allowBlank: true,
          showInputMessage: true,
          promptTitle: 'Expiry Date Format',
          prompt: 'Please enter as DD/MM/YYYY (e.g., 25/08/2027)'
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      res.json({ fileBase64: Buffer.from(buffer).toString('base64') });
    } catch (error: any) {
      console.error("Template generation error on Express server:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const parseExcelDate = (val: any): Date | null => {
    if (!val) return null;
    
    let resolvedVal = val;
    if (resolvedVal && typeof resolvedVal === 'object') {
      if ('result' in resolvedVal) {
        resolvedVal = resolvedVal.result;
      } else if ('richText' in resolvedVal) {
        resolvedVal = resolvedVal.richText.map((rt: any) => rt.text || "").join("");
      } else if ('text' in resolvedVal) {
        resolvedVal = resolvedVal.text;
      }
    }

    if (!resolvedVal) return null;

    let dateObj: Date | null = null;

    if (resolvedVal instanceof Date && !isNaN(resolvedVal.getTime())) {
      dateObj = new Date(resolvedVal.getTime());
    } else if (typeof resolvedVal === 'object' && typeof resolvedVal.getTime === 'function') {
      const time = resolvedVal.getTime();
      if (typeof time === 'number' && !isNaN(time)) {
        dateObj = new Date(time);
      }
    } else if (typeof resolvedVal === 'number' && !isNaN(resolvedVal)) {
      const d = new Date((resolvedVal - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1901 && d.getFullYear() < 2100) {
        dateObj = d;
      }
    } else {
      const strVal = String(resolvedVal).trim();
      if (strVal && strVal.toLowerCase() !== 'null' && strVal.toLowerCase() !== 'undefined') {
        const parts = strVal.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          const p2 = parseInt(parts[2], 10);
          
          if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
            let day = p0;
            let month = p1;
            let year = p2;
            
            if (month > 12 && day <= 12) {
              day = p1;
              month = p0;
            }
            if (year < 100) {
              year += 2000;
            }
            const constructedDate = new Date(year, month - 1, day, 12, 0, 0);
            if (!isNaN(constructedDate.getTime())) {
              dateObj = constructedDate;
            }
          }
        }
        
        if (!dateObj) {
          const d = new Date(strVal);
          if (!isNaN(d.getTime())) {
            dateObj = d;
          }
        }
      }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      return new Date(dateObj.getTime());
    }

    return null;
  };

  // Local Express Bulk Upload Parser
  app.post("/api/pharmacy/bulk-upload", async (req, res) => {
    try {
      const { clinicId, fileBase64, userName } = req.body;
      
      if (!clinicId || !fileBase64) {
        return res.status(400).json({ error: "Missing clinicId or file data." });
      }

      const exceljs = await import("exceljs");
      const Workbook = exceljs.Workbook || (exceljs as any).default?.Workbook;
      if (!Workbook) {
        return res.status(500).json({ error: "ExcelJS.Workbook is undefined" });
      }
      const workbook = new Workbook();
      
      try {
        await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
      } catch (err: any) {
        console.error("load error", err);
        return res.status(400).json({ error: "Invalid Excel file format." });
      }

      const worksheet = workbook.getWorksheet(1);
      const batch = db.batch();
      
      const incomingStock = new Map<string, number>();
      let opCount = 0;

      const getSafeMillis = (dateObj: any): number => {
        if (!dateObj) return 0;
        if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
        if (typeof dateObj.getTime === 'function') return dateObj.getTime();
        const parsed = Date.parse(dateObj);
        return isNaN(parsed) ? (typeof dateObj === 'number' ? dateObj : 0) : parsed;
      };

      const normalizeDosageKey = (dosageStr: string): string => {
        return (dosageStr || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      };

      worksheet?.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const medId = row.getCell(1).value?.toString().trim() || "";
        if (!medId || medId.toUpperCase().includes('EXAMPLE') || medId.toLowerCase().includes('save completed file')) return;
        const batchId = row.getCell(2).value?.toString().trim() || "";
        
        const expiryVal = row.getCell(3).value;
        const expiryDateObj = parseExcelDate(expiryVal);
        const expiry_date = expiryDateObj ? Timestamp.fromDate(expiryDateObj) : null;
        
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
        
        const medLower = medId.toLowerCase().trim();
        const dosageLower = normalizeDosageKey(dosage);
        const stockKey = `${medLower}|${dosageLower}`;
        incomingStock.set(stockKey, (incomingStock.get(stockKey) || 0) + qty);

        const docRef = db.collection(`clinics/${clinicId}/inventory`).doc();
        const payload: any = { 
          medication_id: medId, 
          med_id_lower: medLower, 
          dosage, 
          quantity: qty, 
          created_at: Timestamp.now(),
          created_by_name: userName || "Pharmacist"
        };
        if (batchId) payload.batch_id = batchId;
        if (expiry_date) payload.expiry_date = expiry_date;
        if (base_unit) payload.base_unit = base_unit;
        if (package_unit) payload.package_unit = package_unit;
        
        if (opCount < 400) {
          batch.set(docRef, payload);
          
          const invLogRef = db.collection("inventory_logs").doc();
          batch.set(invLogRef, {
            clinic_id: clinicId,
            medication_name: medId,
            dosage: dosage,
            type: 'add',
            qty: qty,
            user_id: "Anonymous",
            user_name: userName || "Pharmacist",
            timestamp: Timestamp.now()
          });
          
          opCount++;
        }
      });

      // Automatically reconcile the incoming stock with pending procurement requests / shortfalls
      const openReqsSnap = await db.collection("requisitions")
         .where("clinic_id", "==", clinicId)
         .get();

      const openReqs = openReqsSnap.docs
         .map(d => ({ docSnap: d, data: d.data() }))
         .filter(({ data }) => data && data.status !== 'FULFILLED' && data.status !== 'CANCELLED')
         .sort((a, b) => getSafeMillis(a.data?.created_at) - getSafeMillis(b.data?.created_at));

      for (const { docSnap, data } of openReqs) {
         const medLower = (data.medication_name || "").toLowerCase().trim();
         const rawDosage = data.medication_dosage || data.dosage || "N/A";
         const dosageLower = normalizeDosageKey(rawDosage);
         
         let matchedKey = `${medLower}|${dosageLower}`;
         if (!incomingStock.has(matchedKey)) {
            const keys = Array.from(incomingStock.keys());
            const fuzzyKey = keys.find(k => k.startsWith(`${medLower}|`));
            if (fuzzyKey) {
                matchedKey = fuzzyKey;
            }
         }

         if (incomingStock.has(matchedKey)) {
            let remainingStock = incomingStock.get(matchedKey)!;
            let reqQty = data.required_quantity || data.requested_qty || 0;
            
            if (remainingStock > 0 && reqQty > 0 && opCount < 500) {
                let fulfilled = Math.min(remainingStock, reqQty);
                let newReqQty = reqQty - fulfilled;
                let newStock = remainingStock - fulfilled;
                
                incomingStock.set(matchedKey, newStock);
                
                batch.update(docSnap.ref, {
                   required_quantity: newReqQty,
                   status: newReqQty <= 0 ? 'FULFILLED' : (data.status === 'ORDERED' ? 'ORDERED' : 'PENDING'),
                   updated_at: Timestamp.now()
                });
                opCount++;
            } else if (remainingStock > 0 && data.type === 'LOW_STOCK_ALERT' && opCount < 500) {
                batch.update(docSnap.ref, {
                   status: 'FULFILLED',
                   updated_at: Timestamp.now()
                });
                opCount++;
            }
         }
      }

      await batch.commit();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk upload error on Express server:", error);
      res.status(500).json({ error: error.message || "Failed to process bulk upload via Express server fallback." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'web', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
