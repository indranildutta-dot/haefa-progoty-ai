import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Grid, 
  TextField, 
  Button, 
  Chip, 
  Stack, 
  Card, 
  CardContent, 
  Tabs, 
  Tab, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  IconButton, 
  Tooltip, 
  Divider, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Badge,
  Alert
} from '@mui/material';
import { 
  BugReport as BugReportIcon, 
  Search as SearchIcon, 
  PriorityHigh as PriorityHighIcon, 
  CheckCircle as CheckCircleIcon, 
  PendingActions as PendingActionsIcon, 
  Feedback as FeedbackIcon, 
  History as HistoryIcon, 
  CloudUpload as CloudUploadIcon, 
  Close as CloseIcon, 
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  LaptopMac as LaptopMacIcon,
  Info as InfoIcon,
  Notes as NotesIcon,
  FileDownload as FileDownloadIcon,
  AdminPanelSettings as AdminIcon,
  HealthAndSafety as HealthIcon,
  PieChart as PieIcon,
  DownloadDone as DownloadDoneIcon,
  Image as ImageIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import { 
  createTicket, 
  updateTicketStatusAndMetadata, 
  addCommentToTicket, 
  subscribeToMyTickets, 
  subscribeToAllTickets 
} from '../services/ticketService';
import { SupportTicket, TicketComment } from '../types';
import dayjs from 'dayjs';

// Priority Colors
const PRIORITY_THEMES = {
  low: { label: 'Low', color: 'info' as const, bg: '#f1f5f9', fg: '#475569', border: '#cbd5e1' },
  medium: { label: 'Medium', color: 'warning' as const, bg: '#fffbeb', fg: '#d97706', border: '#fde68a' },
  high: { label: 'High', color: 'error' as const, bg: '#fff5f5', fg: '#e11d48', border: '#fecdd3' },
  critical: { label: 'Clinical Block (Critical)', color: 'error' as const, bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' }
};

// Status Themes
const STATUS_THEMES = {
  new: { label: 'New', color: 'info' as const, bg: '#eff6ff', fg: '#1d4ed8', border: '5px solid #2563eb' },
  in_progress: { label: 'In Progress', color: 'warning' as const, bg: '#fff7ed', fg: '#c2410c', border: '5px solid #ea580c' },
  waiting_feedback: { label: 'Waiting for Feedback', color: 'error' as const, bg: '#fdf2f8', fg: '#be185d', border: '5px solid #db2777' },
  resolved: { label: 'Resolved / Closed', color: 'success' as const, bg: '#f0fdf4', fg: '#15803d', border: '5px solid #16a34a' }
};

const STATIONS = [
  'General App Issue',
  'Patient Registration',
  'Body Measures',
  'Vital Signs',
  'Labs & Risk Assessment',
  'Doctor Consultation',
  'Pharmacy / Dispensing',
  'Analytics & Reports',
  'User Login & Access',
  'Offline Mode / Syncing'
];

const SupportCenter: React.FC = () => {
  const { user, userProfile, selectedCountry, selectedClinic } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Form States
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStation, setFormStation] = useState('General App Issue');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [formAttachments, setFormAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Active Selected Ticket (for Details View)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Enlarged Attachment Dialog
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin';

  // 1. Subscribe to Firebase Tickets based on User Role
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    let unsubscribe: () => void;

    if (isAdmin) {
      unsubscribe = subscribeToAllTickets(
        userProfile?.role || '',
        userProfile?.assignedCountries || [],
        (data) => {
          setTickets(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          setError('Failed to fetch support tickets. Please verify your connection or role permissions.');
          setLoading(false);
        }
      );
    } else {
      unsubscribe = subscribeToMyTickets(
        user.uid,
        (data) => {
          setTickets(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          setError('Failed to fetch your tickets. Please check your connectivity or try again.');
          setLoading(false);
        }
      );
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isAdmin, userProfile]);

  // Prevent default window behavior for dragging files onto the page to prevent browser navigation
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // Sync internal admin notes when selected ticket changes (for admins)
  useEffect(() => {
    if (selectedTicket) {
      setAdminNotes(selectedTicket.internal_notes || '');
    }
  }, [selectedTicket]);

  // Keep the active selected ticket updated when real-time updates arrive
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated && updated !== selectedTicket) {
        setSelectedTicket(updated);
      }
    }
  }, [tickets, selectedTicket]);

  // 2. Client-side Image Reader with Canvas Compression
  const processFileList = (filesList: File[]) => {
    filesList.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert('Please drop or select image files only (PNG/JPG).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Canvas Compression Logic: Max 800px width/height and 0.7 quality saves huge Firestore document space
          const canvas = document.createElement('canvas');
          const MAX_DIM = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setFormAttachments((prev) => [...prev, compressedBase64]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    processFileList(Array.from(files));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFileList(Array.from(files));
    }
  };

  const removeAttachmentFromForm = (index: number) => {
    setFormAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const processCommentFileList = (filesList: File[]) => {
    filesList.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert('Please drop or select image files only (PNG/JPG).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Canvas Compression Logic: Max 800px width/height and 0.7 quality saves huge Firestore document space
          const canvas = document.createElement('canvas');
          const MAX_DIM = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setCommentAttachments((prev) => [...prev, compressedBase64]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCommentImageUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    processCommentFileList(Array.from(files));

    if (commentFileInputRef.current) {
      commentFileInputRef.current.value = '';
    }
  };

  const removeAttachmentFromComment = (index: number) => {
    setCommentAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormPaste = (e: React.ClipboardEvent<any>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFileList(files);
    }
  };

  const handleCommentPaste = (e: React.ClipboardEvent<any>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processCommentFileList(files);
    }
  };

  // 3. Submit Incident
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim() || !user) return;

    setIsSubmitting(true);
    setFormAlert(null);

    try {
      const parsedUA = navigator.userAgent;
      const deviceModel = parsedUA.match(/\(([^)]+)\)/)?.[1] || "Unknown Client Device";

      const ticketPayload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        priority: formPriority,
        status: 'new' as const,
        station: formStation,
        submitter_uid: user.uid,
        submitter_name: userProfile?.name || user.email?.split('@')[0] || 'Unknown Staff',
        submitter_email: user.email || '',
        submitter_role: userProfile?.role || 'nurse',
        clinic_id: selectedClinic?.id || '',
        clinic_name: selectedClinic?.name || '',
        country_id: selectedCountry?.id || '',
        country_name: selectedCountry?.name || '',
        userAgent: `${deviceModel} (Browser Context)`,
        attachments: formAttachments,
        comments: [],
        internal_notes: ''
      };

      await createTicket(ticketPayload);
      
      setFormTitle('');
      setFormDesc('');
      setFormStation('General App Issue');
      setFormPriority('low');
      setFormAttachments([]);
      setFormAlert({ type: 'success', msg: 'Your issue ticket is successfully registered in real-time. Admins are notified.' });
      
      // Auto switch tabs to active view so they can review their submissions
      setTimeout(() => {
        setFormAlert(null);
        setActiveTab(0);
      }, 3500);

    } catch (err: any) {
      console.error(err);
      setFormAlert({ type: 'error', msg: 'Failed to register ticket. Please check your connectivity.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Respond to Ticket (add comment)
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && commentAttachments.length === 0) || !selectedTicket || !selectedTicket.id || !user) return;

    setIsReplying(true);
    try {
      const commentPayload: TicketComment = {
        id: Math.random().toString(36).substr(2, 9),
        author_uid: user.uid,
        author_name: userProfile?.name || user.email?.split('@')[0] || 'Staff User',
        author_email: user.email || '',
        author_role: userProfile?.role || 'staff',
        body: newComment.trim(),
        created_at: new Date().toISOString(),
        attachments: commentAttachments
      };

      await addCommentToTicket(selectedTicket.id, commentPayload);
      setNewComment('');
      setCommentAttachments([]);
      
      // If a standard user is replying to a ticket that was waiting for feedback, automatically flag status as NEW or IN PROGRESS
      if (!isAdmin && selectedTicket.status === 'waiting_feedback') {
        await updateTicketStatusAndMetadata(selectedTicket.id, {
          status: 'in_progress',
          updated_at: new Date()
        } as any);
      }
    } catch (err) {
      console.error("Failed to append reply comment:", err);
    } finally {
      setIsReplying(false);
    }
  };

  // 5. Admin Actions (Metadata changes)
  const handleAdminUpdateMetadata = async (
    newStatus: 'new' | 'in_progress' | 'waiting_feedback' | 'resolved', 
    saveNotes = false
  ) => {
    if (!selectedTicket || !selectedTicket.id || !isAdmin) return;

    try {
      const updates: Partial<SupportTicket> = {
        status: newStatus
      };

      if (saveNotes) {
        updates.internal_notes = adminNotes;
      }

      await updateTicketStatusAndMetadata(selectedTicket.id, updates);
      
      // Flash temporary feedback
      alert("Ticket updated successfully!");
    } catch (err) {
      console.error("Failed to commit admin ticket adjustments:", err);
    }
  };

  const handleToggleArchive = async () => {
    if (!selectedTicket || !selectedTicket.id) return;
    
    // Check role authorization as extra safety
    const isSubmitter = selectedTicket.submitter_uid === user?.uid;
    if (!isAdmin && !isSubmitter) {
      alert("You do not have permission to archive this ticket.");
      return;
    }

    try {
      const newArchived = !selectedTicket.is_archived;
      await updateTicketStatusAndMetadata(selectedTicket.id, {
        is_archived: newArchived
      });
      
      alert(
        newArchived 
          ? "Incident archived successfully! It can be accessed under the 'Archived Only' view option." 
          : "Incident restored successfully! It is now active on the primary dashboard."
      );
    } catch (err) {
      console.error("Failed to alter incident archive state:", err);
      alert("Failed to update archive state. Please verify your connection.");
    }
  };

  // Filtered Tickets Computation
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // 1. Search Query Prefix / Contents
      const s = searchQuery.toLowerCase().trim();
      const matchSearch = !s ? true : (
        ticket.title.toLowerCase().includes(s) ||
        ticket.description.toLowerCase().includes(s) ||
        ticket.submitter_name.toLowerCase().includes(s) ||
        ticket.submitter_email.toLowerCase().includes(s) ||
        ticket.id?.toLowerCase().includes(s)
      );

      // 2. Status Match
      const matchStatus = statusFilter === 'all' || ticket.status === statusFilter;

      // 3. Priority Match
      const matchPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

      // 4. Station Match
      const matchStation = stationFilter === 'all' || ticket.station === stationFilter;

      // 5. Archive Match
      let matchArchive = true;
      if (archiveFilter === 'active') {
        matchArchive = !ticket.is_archived;
      } else if (archiveFilter === 'archived') {
        matchArchive = !!ticket.is_archived;
      }

      return matchSearch && matchStatus && matchPriority && matchStation && matchArchive;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, stationFilter, archiveFilter]);

  // Aggregate Metrics (Admin Dashboard Insight Cards)
  const ticketMetrics = useMemo(() => {
    const activeTickets = tickets.filter(t => !t.is_archived);
    const counts = {
      total: activeTickets.length,
      new: activeTickets.filter(t => t.status === 'new').length,
      inProgress: activeTickets.filter(t => t.status === 'in_progress').length,
      waiting: activeTickets.filter(t => t.status === 'waiting_feedback').length,
      resolved: activeTickets.filter(t => t.status === 'resolved').length,
      critical: activeTickets.filter(t => t.priority === 'critical' && t.status !== 'resolved').length
    };
    return counts;
  }, [tickets]);

  // Export Tickets to CSV Format
  const handleExportCSV = () => {
    if (filteredTickets.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "ID", "Title", "Description", "Priority", "Status", "Station", 
      "Clinician Name", "Clinician Email", "Role", "Clinic", "Country", "Device Context", "Created At", "Closed At"
    ];

    const rows = filteredTickets.map(t => [
      t.id, 
      `"${t.title.replace(/"/g, '""')}"`, 
      `"${t.description.replace(/"/g, '""')}"`,
      t.priority.toUpperCase(),
      t.status.toUpperCase(),
      `"${t.station}"`,
      `"${t.submitter_name}"`,
      t.submitter_email,
      t.submitter_role,
      `"${t.clinic_name}"`,
      `"${t.country_name}"`,
      `"${(t.userAgent || '').replace(/"/g, '""')}"`,
      t.created_at ? dayjs(t.created_at.toDate ? t.created_at.toDate() : t.created_at).format('DD/MM/YYYY HH:mm') : '',
      t.status === 'resolved' && t.updated_at ? dayjs(t.updated_at.toDate ? t.updated_at.toDate() : t.updated_at).format('DD/MM/YYYY HH:mm') : 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Progoty_Support_Tickets_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <StationLayout 
      title="Support Center" 
      stationName="ADMINISTRATIVE & TECHNICAL"
      maxWidth="xl"
      showPatientContext={false}
      hideSidebar={true}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {selectedTicket ? (
        // Ticket Detailed Conversation and Control Blade
        <Box sx={{ mt: -2 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => setSelectedTicket(null)}
            sx={{ mb: 3, fontWeight: 800, color: '#475569' }}
          >
            Back to Ticket List
          </Button>

          <Grid container spacing={3}>
            {/* Conversation Thread Panel */}
            <Grid size={{ xs: 12, md: 7, lg: 8 }}>
              <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 1, color: 'text.secondary' }}>
                        TICKET ID: {selectedTicket.id}
                      </Typography>
                      <Chip 
                        label={PRIORITY_THEMES[selectedTicket.priority]?.label || selectedTicket.priority} 
                        color={PRIORITY_THEMES[selectedTicket.priority]?.color}
                        sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="h5" fontWeight="900" sx={{ mt: 1, color: '#0f172a' }}>
                      {selectedTicket.title}
                    </Typography>
                  </Box>
                  <Chip 
                    label={STATUS_THEMES[selectedTicket.status]?.label} 
                    sx={{ 
                      fontWeight: 900, 
                      fontSize: '0.8rem', 
                      color: STATUS_THEMES[selectedTicket.status]?.fg,
                      bgcolor: STATUS_THEMES[selectedTicket.status]?.bg,
                      border: `1px solid ${STATUS_THEMES[selectedTicket.status]?.fg}`,
                      px: 1
                    }} 
                  />
                </Stack>

                <Box sx={{ bgcolor: '#f8fafc', p: 3, borderRadius: 3, border: '1px solid #f1f5f9', mb: 3 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#334155', lineHeight: 1.6 }}>
                    {selectedTicket.description}
                  </Typography>

                  {/* Attachment Thumbnails Viewer inside Ticket description */}
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: '1px border-dashed #e2e8f0' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1}>
                        ATTACHED SCREENSHOTS
                      </Typography>
                      <Stack direction="row" spacing={1.5}>
                        {selectedTicket.attachments.map((base64, index) => (
                          <Paper 
                            key={index}
                            onClick={() => setPreviewAttachmentUrl(base64)}
                            sx={{ 
                              width: 80, 
                              height: 80, 
                              borderRadius: 2, 
                              overflow: 'hidden', 
                              cursor: 'pointer',
                              border: '2px solid #cbd5e1',
                              '&:hover': { transform: 'scale(1.05)', borderColor: 'primary.main' },
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <img src={base64} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Comment / Discussion Timeline */}
                <Typography variant="subtitle1" fontWeight="800" mb={3} sx={{ color: '#0f172a', display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon sx={{ mr: 1, color: 'text.secondary' }} /> Discussion Feed
                </Typography>

                <Stack spacing={2} sx={{ mb: 4, maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                  {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                    <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#f8fafc', borderRadius: 3 }}>
                      <Typography variant="body2" color="text.secondary">No clinical back-and-forth remarks registered yet.</Typography>
                    </Box>
                  ) : (
                    selectedTicket.comments.map((comment) => {
                      const isAuthUserComment = comment.author_uid === user?.uid;
                      const commentAuthorIsAdmin = comment.author_role === 'global_admin' || comment.author_role === 'country_admin';
                      
                      return (
                        <Box 
                          key={comment.id}
                          sx={{ 
                            alignSelf: isAuthUserComment ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            bgcolor: isAuthUserComment ? 'primary.main' : commentAuthorIsAdmin ? '#f0fdf4' : '#f1f5f9',
                            color: isAuthUserComment ? 'white' : '#1e293b',
                            p: 2,
                            borderRadius: 4,
                            borderTopRightRadius: isAuthUserComment ? 1 : 16,
                            borderTopLeftRadius: !isAuthUserComment ? 1 : 16,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            border: !isAuthUserComment && commentAuthorIsAdmin ? '1px solid #bbfcbf' : 'none'
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                            <Typography variant="caption" fontWeight="bold" sx={{ color: isAuthUserComment ? '#cbd5e1' : commentAuthorIsAdmin ? '#166534' : '#475569' }}>
                              {comment.author_name} ({comment.author_role.toUpperCase()})
                            </Typography>
                            {commentAuthorIsAdmin && !isAuthUserComment && (
                              <Chip 
                                label="ADMIN" 
                                size="small" 
                                color="success" 
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 900 }} 
                              />
                            )}
                          </Stack>
                          {comment.body && (
                            <Typography variant="body2" sx={{ wordBreak: 'break-word', lineHeight: 1.5 }}>
                              {comment.body}
                            </Typography>
                          )}

                          {comment.attachments && comment.attachments.length > 0 && (
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }} gap={1}>
                              {comment.attachments.map((imgBase64, idx) => (
                                <Box
                                  key={idx}
                                  component="img"
                                  src={imgBase64}
                                  referrerPolicy="no-referrer"
                                  alt={`Comment Attachment ${idx + 1}`}
                                  sx={{
                                    width: 80,
                                    height: 80,
                                    objectFit: 'cover',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    border: isAuthUserComment ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(15,23,42,0.1)',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                      transform: 'scale(1.05)',
                                    },
                                  }}
                                  onClick={() => setPreviewAttachmentUrl(imgBase64)}
                                />
                              ))}
                            </Stack>
                          )}

                          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: 'right', opacity: 0.7, fontSize: '0.65rem' }}>
                            {dayjs(comment.created_at).format('DD/MM/YYYY HH:mm')}
                          </Typography>
                        </Box>
                      );
                    })
                  )}
                </Stack>

                {/* Reply Form */}
                {selectedTicket.status === 'resolved' ? (
                  <Alert severity="success" sx={{ borderRadius: 3, fontWeight: 'medium' }}>
                    This support ticket has been closed and resolved. Replies are locked by default unless reopened by administrators.
                  </Alert>
                ) : (
                  <form onSubmit={handleAddComment}>
                    {commentAttachments.length > 0 && (
                      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
                        {commentAttachments.map((base64, index) => (
                          <Paper 
                            key={index} 
                            sx={{ 
                              position: 'relative', 
                              width: 75, 
                              height: 75, 
                              overflow: 'hidden', 
                              borderRadius: 2, 
                              border: '1px solid #cbd5e1' 
                            }}
                          >
                            <img src={base64} alt="Comment Attachment Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                            <IconButton 
                              size="small" 
                              onClick={() => removeAttachmentFromComment(index)}
                              sx={{ 
                                position: 'absolute', 
                                top: 2, 
                                right: 2, 
                                bgcolor: 'rgba(15, 23, 42, 0.85)', 
                                color: 'white',
                                p: 0.2,
                                '&:hover': { bgcolor: '#000' }
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 11 }} />
                            </IconButton>
                          </Paper>
                        ))}
                      </Stack>
                    )}

                    {/* Rich-Style Comment Composer Card */}
                    <Box sx={{ border: '2px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', bgcolor: '#f8fafc', '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)' }, transition: 'all 0.15s ease' }}>
                      <TextField 
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Write a message, request clarification, or provide diagnostic details... (Tip: You can take a snippet screenshot and Ctrl+V / paste it directly here to attach!)"
                        variant="standard"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onPaste={handleCommentPaste}
                        disabled={isReplying}
                        slotProps={{
                          input: {
                            disableUnderline: true,
                            sx: { p: 2, bgcolor: '#f8fafc', fontSize: '0.9rem', lineHeight: 1.5 }
                          }
                        }}
                      />
                      
                      {/* Action Bar */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', p: 1.5, bgcolor: '#f1f5f9' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <input 
                            type="file" 
                            ref={commentFileInputRef}
                            style={{ display: 'none' }} 
                            multiple 
                            accept="image/*" 
                            onChange={handleCommentImageUploadChange}
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => commentFileInputRef.current?.click()}
                            disabled={isReplying}
                            startIcon={<ImageIcon />}
                            sx={{
                              borderColor: commentAttachments.length > 0 ? 'primary.main' : '#cbd5e1',
                              color: commentAttachments.length > 0 ? 'primary.main' : 'text.primary',
                              bgcolor: commentAttachments.length > 0 ? 'rgba(79, 70, 229, 0.05)' : 'white',
                              fontWeight: '700',
                              borderRadius: 4,
                              px: 2,
                              py: 0.75,
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              '&:hover': {
                                bgcolor: '#f8fafc',
                                borderColor: 'primary.main'
                              }
                            }}
                          >
                            {commentAttachments.length > 0 ? `Screenshots Attached (${commentAttachments.length})` : 'Attach Screenshot'}
                          </Button>
                        </Stack>

                        <Button 
                          type="submit" 
                          variant="contained" 
                          disabled={(!newComment.trim() && commentAttachments.length === 0) || isReplying}
                          sx={{ borderRadius: 4, px: 3, py: 0.75, textTransform: 'none', fontWeight: 'bold' }}
                          endIcon={isReplying ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
                        >
                          Reply
                        </Button>
                      </Box>
                    </Box>
                  </form>
                )}
              </Paper>
            </Grid>

            {/* Ticket Information & Admin Controls Blade */}
            <Grid size={{ xs: 12, md: 5, lg: 4 }}>
              <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', mb: 3 }}>
                <Typography variant="subtitle2" fontWeight="900" sx={{ letterSpacing: 1, color: 'text.secondary', mb: 2 }}>
                  TICKET METADATA
                </Typography>
                
                <Stack spacing={2} sx={{ mb: 4 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">SUBMISSION AREA (STATION)</Typography>
                    <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>{selectedTicket.station}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">DATE REPORTED</Typography>
                    <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                      {selectedTicket.created_at ? dayjs(selectedTicket.created_at.toDate ? selectedTicket.created_at.toDate() : selectedTicket.created_at).format('DD/MM/YYYY HH:mm') : 'Draft'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">REPORTED BY</Typography>
                    <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                      {selectedTicket.submitter_name} ({selectedTicket.submitter_role.toUpperCase()})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{selectedTicket.submitter_email}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">SUBMITTING CLINIC / COUNTRY</Typography>
                    <Typography variant="body2" fontWeight="700" sx={{ color: '#0f172a' }}>
                      {selectedTicket.clinic_name || 'N/A'} - {selectedTicket.country_name || 'Global'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">SUBMITTER PLATFORM/DEVICE INFO</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                      <LaptopMacIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: '500' }}>
                        {selectedTicket.userAgent || 'Unknown environment context'}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>

                {/* Archive/Unarchive Action block accessible to Admin OR Submitter */}
                {(isAdmin || selectedTicket.submitter_uid === user?.uid) && (
                  <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e2e8f0', mb: 3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1}>
                      INCIDENT RETENTION ACTION
                    </Typography>
                    <Button
                      fullWidth
                      variant="outlined"
                      color={selectedTicket.is_archived ? "success" : "warning"}
                      startIcon={selectedTicket.is_archived ? <UnarchiveIcon /> : <ArchiveIcon />}
                      onClick={handleToggleArchive}
                      sx={{ fontWeight: '900', borderRadius: 3, textTransform: 'uppercase', py: 1 }}
                    >
                      {selectedTicket.is_archived ? "Restore / Unarchive" : "Archive Incident"}
                    </Button>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontSize: '0.72rem', lineHeight: 1.4 }}>
                      {selectedTicket.is_archived 
                        ? "Restoring this ticket makes it active and visible back on the main dashboard tab for active tracking."
                        : "Archiving hides this ticket from the active list to prevent interface clutter without deleting history."
                      }
                    </Typography>
                  </Box>
                )}

                {isAdmin && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" fontWeight="900" sx={{ letterSpacing: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AdminIcon sx={{ fontSize: 18, mr: 0.5, color: 'primary.main' }} /> ADMINISTRATIVE ACTIONS
                    </Typography>

                    <Stack spacing={2.5}>
                      {/* Set Status Selection Buttons */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1}>
                          RESOLVE & PROGRESS STATUS
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {(['new', 'in_progress', 'waiting_feedback', 'resolved'] as const).map((st) => (
                            <Button
                              key={st}
                              size="small"
                              variant={selectedTicket.status === st ? 'contained' : 'outlined'}
                              color={STATUS_THEMES[st]?.color}
                              onClick={() => handleAdminUpdateMetadata(st)}
                              sx={{ 
                                textTransform: 'capitalize', 
                                fontWeight: 800, 
                                borderRadius: 3,
                                py: 0.5,
                                fontSize: '0.7rem'
                              }}
                            >
                              {STATUS_THEMES[st]?.label}
                            </Button>
                          ))}
                        </Stack>
                      </Box>

                      {/* Administrative Private/Team Notes */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1}>
                          ADMIN INTERNAL NOTES / DISPOSITION LABELS
                        </Typography>
                        <TextField 
                          fullWidth
                          multiline
                          rows={4}
                          variant="outlined"
                          placeholder="Write private summaries, internal tracking details, resolution actions..."
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          sx={{ 
                            '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fcf8f2', fontSize: '0.85rem' }
                          }}
                        />
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          color="secondary"
                          onClick={() => handleAdminUpdateMetadata(selectedTicket.status, true)}
                          sx={{ mt: 1.5, fontWeight: 900, borderRadius: 3 }}
                        >
                          Save Internal Notes
                        </Button>
                      </Box>
                    </Stack>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      ) : (
        // Main Screen Interface (Submission Tab vs Ticket Board)
        <Box>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, val) => setActiveTab(val)}
              textColor="primary"
              indicatorColor="primary"
              variant="fullWidth"
              sx={{ 
                '& .MuiTab-root': { fontWeight: 900, letterSpacing: 0.5, fontSize: '0.90rem' }
              }}
            >
              <Tab icon={<HistoryIcon sx={{ fontSize: 20 }} />} label="Incident Dashboard" iconPosition="start" />
              <Tab icon={<BugReportIcon sx={{ fontSize: 20 }} />} label="Submit a Ticket" iconPosition="start" />
            </Tabs>
          </Box>

          {activeTab === 0 ? (
            // Tab 1: Ticket Board & List View
            <Box>
              {isAdmin && (
                // Admin Dashboard Metric Inserts
                <Box sx={{ mb: 4 }}>
                  <Typography variant="overline" color="text.secondary" fontWeight="950" sx={{ letterSpacing: 2, display: 'block', mb: 2 }}>
                    ADMIN REAL-TIME METRICS
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fff', border: '1px solid #e1e8ed' }}>
                        <Typography variant="caption" fontWeight="900" color="text.secondary" display="block">TOTAL TICKETS</Typography>
                        <Typography variant="h4" fontWeight="1000" color="primary.main" sx={{ mt: 1 }}>{ticketMetrics.total}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fff', border: '1px solid #e1e8ed' }}>
                        <Typography variant="caption" fontWeight="900" color="#1d4ed8" display="block">NEW</Typography>
                        <Typography variant="h4" fontWeight="1000" color="#2563eb" sx={{ mt: 1 }}>{ticketMetrics.new}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fff', border: '1px solid #e1e8ed' }}>
                        <Typography variant="caption" fontWeight="900" color="#c2410c" display="block">IN PROGRESS</Typography>
                        <Typography variant="h4" fontWeight="1000" color="#ea580c" sx={{ mt: 1 }}>{ticketMetrics.inProgress}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fff', border: '1px solid #e1e8ed' }}>
                        <Typography variant="caption" fontWeight="900" color="#be185d" display="block">REPLY WAITING</Typography>
                        <Typography variant="h4" fontWeight="1000" color="#db2777" sx={{ mt: 1 }}>{ticketMetrics.waiting}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fff', border: '1px solid #e1e8ed' }}>
                        <Typography variant="caption" fontWeight="900" color="#15803d" display="block">RESOLVED</Typography>
                        <Typography variant="h4" fontWeight="1000" color="#16a34a" sx={{ mt: 1 }}>{ticketMetrics.resolved}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 4, bgcolor: '#fef2f2', border: '1px solid #fecdd3' }}>
                        <Typography variant="caption" fontWeight="900" color="#991b1b" display="block">BLOCKED ISSUES</Typography>
                        <Typography variant="h4" fontWeight="1000" color="#e11d48" sx={{ mt: 1 }}>
                          {ticketMetrics.critical}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* SEARCH & ACCENT FILTERS BAR */}
              <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid #cbd5e1', boxShadow: 'none', mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField 
                      fullWidth
                      size="small"
                      placeholder="Search title, description, user..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                  </Grid>
                  
                  <Grid size={{ xs: 6, sm: 4, md: 1.8 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select 
                        value={statusFilter} 
                        label="Status" 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        sx={{ borderRadius: 3 }}
                      >
                        <MenuItem value="all">All Statuses</MenuItem>
                        <MenuItem value="new">New</MenuItem>
                        <MenuItem value="in_progress">In Progress</MenuItem>
                        <MenuItem value="waiting_feedback">Waiting Feedback</MenuItem>
                        <MenuItem value="resolved">Resolved / Closed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 4, md: 1.8 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select 
                        value={priorityFilter} 
                        label="Priority" 
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        sx={{ borderRadius: 3 }}
                      >
                        <MenuItem value="all">All Priorities</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical Block</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 4, md: 1.8 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Station</InputLabel>
                      <Select 
                        value={stationFilter} 
                        label="Station" 
                        onChange={(e) => setStationFilter(e.target.value)}
                        sx={{ borderRadius: 3 }}
                      >
                        <MenuItem value="all">All Stations</MenuItem>
                        {STATIONS.map(st => (
                          <MenuItem key={st} value={st}>{st}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 4, md: 1.8 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Archive View</InputLabel>
                      <Select 
                        value={archiveFilter} 
                        label="Archive View" 
                        onChange={(e) => setArchiveFilter(e.target.value as any)}
                        sx={{ borderRadius: 3 }}
                      >
                        <MenuItem value="active">Active Incidents</MenuItem>
                        <MenuItem value="archived">Archived Only</MenuItem>
                        <MenuItem value="all">All Incidents</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4, md: 1.8 }}>
                    <Button 
                      fullWidth
                      variant="outlined" 
                      color="secondary"
                      onClick={handleExportCSV}
                      startIcon={<FileDownloadIcon />}
                      sx={{ fontWeight: 850, borderRadius: 3, height: 40 }}
                    >
                      Export CSV
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {/* LIST OF CURRENT TICKETS */}
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={45} />
                </Box>
              ) : filteredTickets.length === 0 ? (
                <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 4, bgcolor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                  <Typography variant="body1" color="text.secondary" fontWeight="700">
                    No support tickets found matching selection.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {filteredTickets.map((ticket) => {
                    const statusTheme = STATUS_THEMES[ticket.status] || { label: 'Unknown', fg: '#000', bg: '#fff', border: 'none' };
                    const priorityTheme = PRIORITY_THEMES[ticket.priority] || { label: 'Normal', fg: '#000', bg: '#fff', border: '#cbd5e1' };
                    const commentsCount = ticket.comments?.length || 0;
                    
                    return (
                      <Paper 
                        key={ticket.id} 
                        onClick={() => setSelectedTicket(ticket)}
                        sx={{ 
                          p: 3, 
                          borderRadius: 4, 
                          border: '1px solid #cbd5e1', 
                          borderLeft: ticket.is_archived ? '5px solid #94a3b8' : statusTheme.border,
                          boxShadow: 'none', 
                          cursor: 'pointer',
                          bgcolor: ticket.is_archived ? '#f1f5f9' : '#ffffff',
                          opacity: ticket.is_archived ? 0.8 : 1,
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: 'primary.main' },
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        <Grid container spacing={2} alignItems="center">
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', fontFamily: 'monospace' }}>
                                #{ticket.id?.substr(0, 8)}
                              </Typography>
                              {ticket.is_archived && (
                                <Chip 
                                  icon={<ArchiveIcon sx={{ '&&': { color: '#475569', fontSize: 13 } }} />}
                                  label="ARCHIVED" 
                                  size="small" 
                                  sx={{ fontWeight: '900', height: 20, fontSize: '0.62rem', color: '#475569', bgcolor: '#e2e8f0', border: '1px solid #cbd5e1' }} 
                                />
                              )}
                              <Chip 
                                label={ticket.station} 
                                size="small" 
                                variant="outlined" 
                                sx={{ fontWeight: '800', height: 20, fontSize: '0.65rem', color: '#1e293b' }} 
                              />
                            </Stack>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a', mb: 1 }}>
                              {ticket.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1 }}>
                              {ticket.description}
                            </Typography>

                            <Stack direction="row" spacing={2.5} alignItems="center" flexWrap="wrap">
                              <Typography variant="caption" color="text.secondary" fontWeight="600">
                                Opened by: <b style={{ color: '#000' }}>{ticket.submitter_name}</b> ({ticket.submitter_role.toUpperCase()})
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight="600">
                                Clinic: <b style={{ color: '#000' }}>{ticket.clinic_name || 'Global'}</b>
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight="600">
                                Date: {ticket.created_at ? dayjs(ticket.created_at.toDate ? ticket.created_at.toDate() : ticket.created_at).format('DD/MM/YYYY HH:mm') : 'Draft'}
                              </Typography>
                            </Stack>
                          </Grid>

                          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1.5 }}>
                            <Chip 
                              label={statusTheme.label} 
                              size="medium"
                              sx={{ 
                                fontWeight: 900, 
                                color: statusTheme.fg, 
                                bgcolor: statusTheme.bg,
                                display: 'block',
                                border: `1px solid ${statusTheme.fg}`,
                                textTransform: 'uppercase',
                                fontSize: '0.7rem'
                              }} 
                            />
                            
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Chip 
                                label={`${priorityTheme.label} Priority`}
                                size="small"
                                sx={{ 
                                  fontWeight: '800', 
                                  color: priorityTheme.fg, 
                                  bgcolor: priorityTheme.bg, 
                                  border: `1px solid ${priorityTheme.border}`,
                                  fontSize: '0.65rem'
                                }} 
                              />
                              
                              {commentsCount > 0 && (
                                <Badge badgeContent={commentsCount} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', fontWeight: 900 } }}>
                                  <FeedbackIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                </Badge>
                              )}
                            </Stack>
                          </Grid>
                        </Grid>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
          ) : (
            // Tab 2: Submit a Ticket Form
            <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #cbd5e1', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <BugReportIcon color="primary" sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight="900" sx={{ color: '#0f172a' }}>
                    Register a New Issue or System Feedback
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Your current local device diagnostic parameters will be collected alongside this report automatically.
                  </Typography>
                </Box>
              </Box>

              {formAlert && (
                <Alert severity={formAlert.type} sx={{ borderRadius: 3, mb: 3, fontWeight: 'medium' }}>
                  {formAlert.msg}
                </Alert>
              )}

              <form onSubmit={handleCreateTicket} onPaste={handleFormPaste}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    <TextField 
                      fullWidth
                      required
                      label="Ticket Title / Summary of Issue"
                      variant="outlined"
                      placeholder="e.g. Vitals Station - SpO2 alerts failing to display properly on tablet"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Station or Module Involved</InputLabel>
                      <Select
                        value={formStation}
                        label="Station or Module Involved"
                        onChange={(e) => setFormStation(e.target.value)}
                        sx={{ borderRadius: 3 }}
                      >
                        {STATIONS.map((station) => (
                          <MenuItem key={station} value={station}>{station}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Impact Priority</InputLabel>
                      <Select
                        value={formPriority}
                        label="Impact Priority"
                        onChange={(e) => setFormPriority(e.target.value as any)}
                        sx={{ borderRadius: 3 }}
                      >
                        <MenuItem value="low">Low (Cosmetic/Typo/Suggestion)</MenuItem>
                        <MenuItem value="medium">Medium (Annoying but workaround exists)</MenuItem>
                        <MenuItem value="high">High (Broken functionality/Stops workflow)</MenuItem>
                        <MenuItem value="critical">Clinical Block (Patient care halted! Critical Alert)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField 
                      fullWidth
                      required
                      multiline
                      rows={6}
                      label="Step-by-Step Description of the Issue"
                      variant="outlined"
                      placeholder="Please specify exactly what you were doing, what you observed, what you expected, and any particular patient ID we can search for if it's localized to a patient record... (Tip: You can take a snippet screenshot and Ctrl+V / paste it directly here to attach!)"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                  </Grid>

                  {/* Screenshot / Image Drag Zone */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" sx={{ fontWeight: '700', color: '#1e293b', mb: 1.5 }}>
                      Attach Screenshots (Max 3, PNG/JPG formats accepted)
                    </Typography>
                    
                    <Box 
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      sx={{ 
                        border: '2px dashed #cbd5e1', 
                        borderRadius: 3, 
                        p: 4, 
                        textAlign: 'center', 
                        cursor: 'pointer',
                        bgcolor: '#f8fafc',
                        '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.02)', borderColor: 'primary.main' },
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" fontWeight="bold">Drag & Drop or Click to Select screenshots</Typography>
                      <Typography variant="caption" color="text.secondary">Accepted images: PNG, JPG, GIF. Max image storage footprint is managed automatically via compression. (Tip: You can also copy and Ctrl+V / paste images directly!)</Typography>
                    </Box>

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      style={{ display: 'none' }} 
                      multiple 
                      accept="image/*" 
                      onChange={handleImageUploadChange}
                    />

                    {formAttachments.length > 0 && (
                      <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" gap={1.5}>
                        {formAttachments.map((base64, index) => (
                          <Paper 
                            key={index} 
                            onClick={() => setPreviewAttachmentUrl(base64)}
                            sx={{ 
                              position: 'relative', 
                              width: 100, 
                              height: 100, 
                              overflow: 'hidden', 
                              borderRadius: 2, 
                              border: '2px solid #cbd5e1',
                              cursor: 'pointer',
                              '&:hover': { transform: 'scale(1.02)', borderColor: 'primary.main' },
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <img src={base64} alt="Pre-upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAttachmentFromForm(index);
                              }}
                              sx={{ 
                                position: 'absolute', 
                                top: 4, 
                                right: 4, 
                                bgcolor: 'rgba(15, 23, 42, 0.85)', 
                                color: 'white',
                                '&:hover': { bgcolor: '#000' }
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Button 
                      type="submit" 
                      variant="contained" 
                      size="large" 
                      disabled={isSubmitting || !formTitle.trim() || !formDesc.trim()}
                      sx={{ borderRadius: 3, fontWeight: 900, px: 4 }}
                    >
                      {isSubmitting ? 'Registering Ticket...' : 'File Support Ticket'}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
          )}
        </Box>
      )}

      {/* Enlarged Attachment Dialog Preview */}
      <Dialog 
        open={previewAttachmentUrl !== null} 
        onClose={() => setPreviewAttachmentUrl(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography fontWeight="800">Screenshot Preview</Typography>
          <IconButton onClick={() => setPreviewAttachmentUrl(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, bgcolor: '#0f172a', textAlign: 'center' }}>
          {previewAttachmentUrl && (
            <img 
              src={previewAttachmentUrl} 
              alt="Screenshot enlarge" 
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} 
              referrerPolicy="no-referrer"
            />
          )}
        </DialogContent>
      </Dialog>
    </StationLayout>
  );
};

export default SupportCenter;
