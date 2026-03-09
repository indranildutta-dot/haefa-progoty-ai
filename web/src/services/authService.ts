import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  User
} from "firebase/auth";
import { auth } from "../firebase";
import { UserProfile } from "../types";

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const login = async (email: string, pass: string) => {
  return signInWithEmailAndPassword(auth, email, pass);
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
    countryId: "BD"
  };
};
