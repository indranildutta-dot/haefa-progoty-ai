import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Stack, Chip 
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import dayjs, { Dayjs } from 'dayjs';

interface InventoryItem {
  id: string;
  medication_id: string;
  dosage: string;
  quantity: number;
  created_at?: any;
  created_by_name?: string;
}

interface InventoryLog {
  id: string;
  medication_name: string;
  dosage: string;
  type: 'add' | 'dispense';
  qty: number;
  user_name: string;
  timestamp: any;
}

interface AnalyticsProps {
  clinicId: string;
  inventory: InventoryItem[];
}

const cleanDosageStr = (str: string) => {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
};

const toDateSafely = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') return new Date(timestamp);
  return null;
};

const InventoryAnalytics: React.FC<AnalyticsProps> = ({ clinicId, inventory }) => {
  const [fromDate, setFromDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [toDate, setToDate] = useState<Dayjs | null>(dayjs().endOf('month'));
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!clinicId || !fromDate) return;
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const fromDateStart = fromDate.startOf('day').toDate();
        
        // 1. Fetch addition logs from the db
        const logsQuery = query(
          collection(db, "inventory_logs"),
          where("clinic_id", "==", clinicId),
          where("timestamp", ">=", fromDateStart)
        );
        const snapshot = await getDocs(logsQuery);
        const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog));
        
        // 2. Fetch prescriptions (to reconstruct dispensations directly from clinical source of truth)
        const presQuery = query(
          collection(db, "prescriptions"),
          where("clinic_id", "==", clinicId)
        );
        const presSnapshot = await getDocs(presQuery);
        
        const reconstructedDispLog: InventoryLog[] = [];
        presSnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status !== 'DISPENSED' && data.status !== 'PARTIAL_DISPENSED') return;
          
          const timestamp = data.updated_at || data.dispensedDate || data.created_at;
          const pDate = toDateSafely(timestamp);
          
          // Verify with local start boundary
          if (pDate && pDate >= fromDateStart) {
            const user_name = data.dispenser_name || 'Pharmacist';
            const details = Array.isArray(data.dispensation_details) ? data.dispensation_details : [];
            
            details.forEach((item: any, idx: number) => {
              const medName = item.medication || item.medication_name || '';
              const medDosage = item.dosage || '';
              const qty = Number(item.dispensed) || 0;
              
              if (medName && qty > 0) {
                reconstructedDispLog.push({
                  id: `pres-${docSnap.id}-${idx}`,
                  medication_name: medName,
                  dosage: medDosage,
                  type: 'dispense' as const,
                  qty: qty,
                  user_name: user_name,
                  timestamp: timestamp
                });
              }
            });
          }
        });

        // 3. Keep additions from logged events, and dispensations strictly from reconstructed prescriptions to prevent double-counting
        const additionLogs = fetchedLogs.filter(l => l.type === 'add');
        setLogs([...additionLogs, ...reconstructedDispLog]);
      } catch (e) {
        console.error("Error fetching inventory elements:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [clinicId, fromDate]);

  const summary = useMemo(() => {
    const toDateEnd = (toDate || dayjs()).endOf('day').toDate();
    const fromDateStart = (fromDate || dayjs()).startOf('day').toDate();
    const periodLogs = logs.filter(l => l.timestamp && toDateSafely(l.timestamp)! <= toDateEnd);
    const afterPeriodLogs = logs.filter(l => l.timestamp && toDateSafely(l.timestamp)! > toDateEnd);

    const medMap = new Map<string, any>();
    
    // Initialize with current inventory
    inventory.forEach((item: any) => {
      const nameStr = (item.medication_id || item.name || '').toLowerCase().trim();
      const dosageStr = (item.dosage || '').toLowerCase().trim();
      const key = `${nameStr}|${cleanDosageStr(dosageStr)}`;
      
      if (!medMap.has(key)) {
        medMap.set(key, {
          name: item.medication_id || item.name || 'Unknown',
          dosage: item.dosage || '',
          currentStock: 0,
          addedInPeriod: 0,
          dispensedInPeriod: 0,
          addedAfterPeriod: 0,
          dispensedAfterPeriod: 0,
          additions: [], // Track individual additions to show date and user
          key
        });
      }
      medMap.get(key)!.currentStock += (Number(item.quantity) || 0);
    });

    // Track which keys have explicit 'add' logs in the database
    const loggedAddKeys = new Set<string>();
    logs.forEach(l => {
      if (l.type === 'add') {
        const k = `${(l.medication_name || '').toLowerCase().trim()}|${cleanDosageStr(l.dosage)}`;
        loggedAddKeys.add(k);
      }
    });

    // Synthesize additions for items created during/after the period with no explicit logs
    inventory.forEach((item: any) => {
      const nameStr = (item.medication_id || item.name || '').toLowerCase().trim();
      const dosageStr = (item.dosage || '').toLowerCase().trim();
      const key = `${nameStr}|${cleanDosageStr(dosageStr)}`;
      
      if (!loggedAddKeys.has(key) && item.created_at) {
        const createdDate = toDateSafely(item.created_at);
        if (createdDate) {
          const synthLog = {
            id: `synth-${item.id}`,
            medication_name: item.medication_id || item.name || 'Unknown',
            dosage: item.dosage || '',
            type: 'add' as const,
            qty: Number(item.quantity) || 0,
            user_name: item.created_by_name || 'System (Excel Import)',
            timestamp: item.created_at
          };
          
          const isAfter = (createdDate > toDateEnd);
          const isBefore = (createdDate < fromDateStart);
          
          if (!isBefore) {
            if (isAfter) {
              medMap.get(key)!.addedAfterPeriod += synthLog.qty;
            } else {
              medMap.get(key)!.addedInPeriod += synthLog.qty;
              medMap.get(key)!.additions.push(synthLog);
            }
          }
        }
      }
    });

    // Process actual and reconstructed logs
    const processLog = (log: InventoryLog, isAfter: boolean) => {
      const key = `${(log.medication_name || '').toLowerCase().trim()}|${cleanDosageStr(log.dosage)}`;
      if (!medMap.has(key)) {
        medMap.set(key, {
          name: log.medication_name,
          dosage: log.dosage || '',
          currentStock: 0,
          addedInPeriod: 0,
          dispensedInPeriod: 0,
          addedAfterPeriod: 0,
          dispensedAfterPeriod: 0,
          additions: [],
          key
        });
      }
      
      const record = medMap.get(key)!;
      const qty = Number(log.qty) || 0;
      
      if (isAfter) {
        if (log.type === 'add') record.addedAfterPeriod += qty;
        else if (log.type === 'dispense') record.dispensedAfterPeriod += qty;
      } else {
        if (log.type === 'add') {
          record.addedInPeriod += qty;
          if (!record.additions.some((x: any) => x.id === log.id)) {
            record.additions.push(log);
          }
        }
        else if (log.type === 'dispense') {
          record.dispensedInPeriod += qty;
        }
      }
    };

    periodLogs.forEach(l => processLog(l, false));
    afterPeriodLogs.forEach(l => processLog(l, true));

    // Calculate beginning and ending balances
    const result = Array.from(medMap.values()).map(record => {
      const endingBalance = record.currentStock - record.addedAfterPeriod + record.dispensedAfterPeriod;
      const beginningBalance = endingBalance - record.addedInPeriod + record.dispensedInPeriod;
      return {
        ...record,
        beginningBalance: Math.max(0, beginningBalance), // Avoid negative due to data inconsistencies
        endingBalance: Math.max(0, endingBalance)
      };
    });

    // Sort alphabetically by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, inventory, toDate, fromDate]);

  return (
    <Box>
      <Paper sx={{ p: 4, mb: 4, borderRadius: 5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="flex-start" spacing={3}>
          <Box>
             <Typography variant="h6" fontWeight="bold">Inventory Analytics Report</Typography>
             <Typography variant="body2" color="text.secondary" mt={0.5}>
                Track beginning balances, new shipments added, and dispensed amounts over a chosen time period.
             </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <DatePicker
              label="From Date"
              value={fromDate}
              onChange={(val) => setFromDate(val)}
              format="DD/MM/YYYY"
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="To Date"
              value={toDate}
              onChange={(val) => setToDate(val)}
              format="DD/MM/YYYY"
              slotProps={{ textField: { size: 'small' } }}
              minDate={fromDate || undefined}
            />
          </Stack>
        </Stack>
      </Paper>

      {isLoading ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : summary.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4 }}>
          <Typography color="text.secondary">No data available for the selected period.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Medication Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Dosage</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Beginning Bal.</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Added (New)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Dispensed</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Ending Bal.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.filter(r => r.beginningBalance > 0 || r.addedInPeriod > 0 || r.dispensedInPeriod > 0).map(row => (
                <React.Fragment key={row.key}>
                  <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell>{row.dosage || '-'}</TableCell>
                    <TableCell>
                      <Chip label={row.beginningBalance} size="small" sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell>
                      {row.addedInPeriod > 0 ? (
                        <Typography variant="body2" color="success.main" fontWeight="bold">+{row.addedInPeriod}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.dispensedInPeriod > 0 ? (
                        <Typography variant="body2" color="error.main" fontWeight="bold">-{row.dispensedInPeriod}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1em' }}>{row.endingBalance}</TableCell>
                  </TableRow>
                  {row.additions.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ pb: 2, pt: 0, bgcolor: '#fbfcfd' }}>
                        <Box sx={{ ml: 4, mr: 4, p: 2, border: '1px dashed #e2e8f0', borderRadius: 2, bgcolor: '#fff' }}>
                          <Typography variant="caption" fontWeight="bold" color="text.secondary" gutterBottom display="block">
                            SHIPMENT HISTORY (ADDED IN THIS PERIOD)
                          </Typography>
                          <Table size="small" sx={{ '& td, & th': { borderBottom: 'none' } }}>
                            <TableBody>
                              {row.additions.map((addLog: InventoryLog) => (
                                <TableRow key={addLog.id}>
                                  <TableCell sx={{ py: 0.5 }}>
                                    <Typography variant="body2">+{addLog.qty} {row.dosage || ''}</Typography>
                                  </TableCell>
                                  <TableCell sx={{ py: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      added by <strong>{addLog.user_name}</strong>
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ py: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      on {addLog.timestamp ? dayjs(toDateSafely(addLog.timestamp)).format('DD/MM/YYYY HH:mm') : '-'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default InventoryAnalytics;
