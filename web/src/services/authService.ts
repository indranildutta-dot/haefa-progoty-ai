import { 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  hd: 'haefa.org'
});

const SUPER_ADMIN_EMAILS = [
  'indranil_dutta@haefa.org',
  'ruhul_abid@haefa.org'
];

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = async () => {
  return signInWithPopup(auth, provider);
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

    // SUPER ADMIN BYPASS: If email is hardcoded, ensure they have global_admin role
    if (normalizedEmail && SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
      return {
        uid,
        email: normalizedEmail,
        role: 'global_admin',
        isApproved: true,
        assignedClinics: profile?.assignedClinics || [],
        assignedCountries: profile?.assignedCountries || ['BD'],
        ...profile // Merge existing profile data if any
      } as UserProfile;
    }

    return profile;
  } catch (error) {
    console.error("Error fetching Firestore profile:", error);
    return null;
  }
};