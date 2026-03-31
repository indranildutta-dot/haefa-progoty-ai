import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch the user document from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            const defaultAdmins = ['indranil_dutta@haefa.org', 'ruhul_abid@haefa.org'];
            const isBootstrapAdmin = user.email && defaultAdmins.includes(user.email);
            
            if (isBootstrapAdmin && (!profile.isApproved || profile.role !== 'global_admin')) {
              const updatedProfile: UserProfile = {
                ...profile,
                role: 'global_admin',
                isApproved: true
              };
              await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(profile);
            }
          } else {
            // Self-provisioning for default admin
            const defaultAdmins = ['indranil_dutta@haefa.org', 'ruhul_abid@haefa.org'];
            if (user.email && defaultAdmins.includes(user.email)) {
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                role: 'global_admin',
                isApproved: true,
                country_id: 'BD', // Default
                assignedCountries: ['BD'],
                assignedClinics: []
              };
              await setDoc(doc(db, 'users', user.uid), newProfile);
              setUserProfile(newProfile);
            } else {
              setUserProfile(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, userProfile, loading };
};
