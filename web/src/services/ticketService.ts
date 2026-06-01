import { 
  collection, 
  addDoc, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  orderBy, 
  onSnapshot,
  arrayUnion
} from "firebase/firestore";
import { db } from "../firebase";
import { SupportTicket, TicketComment } from "../types";

const COLLECTION_NAME = "support_tickets";

/**
 * Creates a new support ticket in Firestore.
 */
export const createTicket = async (
  ticketData: Omit<SupportTicket, "id" | "created_at" | "updated_at">
): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...ticketData,
    comments: ticketData.comments || [],
    attachments: ticketData.attachments || [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Updates an existing ticket's metadata (e.g. status, notes, priority).
 */
export const updateTicketStatusAndMetadata = async (
  ticketId: string,
  updates: Partial<SupportTicket>
): Promise<void> => {
  const ticketRef = doc(db, COLLECTION_NAME, ticketId);
  await updateDoc(ticketRef, {
    ...updates,
    updated_at: serverTimestamp()
  });
};

/**
 * Appends a communication comment thread directly to a ticket's comments array in a single atomic update.
 */
export const addCommentToTicket = async (
  ticketId: string,
  comment: TicketComment
): Promise<void> => {
  const ticketRef = doc(db, COLLECTION_NAME, ticketId);
  await updateDoc(ticketRef, {
    comments: arrayUnion(comment),
    updated_at: serverTimestamp()
  });
};

/**
 * Subscribes to real-time updates for tickets submitted by the current medical staff user.
 */
export const subscribeToMyTickets = (
  uid: string,
  onUpdate: (tickets: SupportTicket[]) => void,
  onError: (err: any) => void
) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("submitter_uid", "==", uid),
    orderBy("created_at", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];
      onUpdate(tickets);
    },
    (err) => {
      console.error("Error loading user tickets in real-time:", err);
      onError(err);
    }
  );
};

/**
 * Subscribes to real-time updates for ALL tickets (strictly authorized for Administrators).
 */
export const subscribeToAllTickets = (
  onUpdate: (tickets: SupportTicket[]) => void,
  onError: (err: any) => void
) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("created_at", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];
      onUpdate(tickets);
    },
    (err) => {
      console.error("Error loading all tickets for administrator:", err);
      onError(err);
    }
  );
};
