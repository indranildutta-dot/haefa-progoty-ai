import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

export const MASTER_ADMINS = [
  'indranil_dutta@haefa.org',
  'ruhul_abid@haefa.org'
];

export const SUPER_ADMIN_EMAILS = MASTER_ADMINS;

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const loginWithEmailAndPassword = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  return signOut(auth);
};

/**
 * Fetches the real RBAC profile from Firestore.
 * Matches your screenshots: assignedClinics, isApproved, role.
 */
export const getUserProfile = async (uid: string, email?: string | null): Promise<UserProfile | null> => {
  try {
    const normalizedEmail = email?.toLowerCase();
    
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    let profile: UserProfile | null = null;

    if (docSnap.exists()) {
      profile = { uid, ...docSnap.data() } as UserProfile;
    }

    // MASTER ADMIN OVERRIDE: If authenticated user's email is in MASTER_ADMINS, immediately override any database role restrictions and grant full global_admin status.
    if (normalizedEmail && MASTER_ADMINS.includes(normalizedEmail)) {
      return {
        uid,
        email: normalizedEmail,
        role: 'global_admin',
        isApproved: true,
        assignedClinics: profile?.assignedClinics || [],
        assignedCountries: profile?.assignedCountries || ['BD'],
        ...profile, // Merge existing profile data if any
        role_override: true // flag to indicate override
      } as UserProfile;
    }

    return profile;
  } catch (error) {
    console.error("Error fetching Firestore profile:", error);
    return null;
  }
};