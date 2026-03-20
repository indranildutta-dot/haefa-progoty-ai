import { 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from "firebase/auth";
import { auth } from "../firebase";
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

// Mock function for now
export const getUserProfile = async (uid: string): Promise<UserProfile> => {
  return {
    uid,
    email: "test@haefa.org",
    role: "admin",
    name: "Test User",
    countryCode: "BD",
    isApproved: true
  };
};
