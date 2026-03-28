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
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { uid, ...docSnap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching Firestore profile:", error);
    return null;
  }
};