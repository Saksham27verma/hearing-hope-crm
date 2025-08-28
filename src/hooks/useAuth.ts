import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff';
  allowedModules?: string[];
  createdAt: number;
  branchId?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (authUser) {
          setUser(authUser);
          
          // Fetch additional user data from Firestore
          const userDocRef = doc(db, 'users', authUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            setUserProfile({
              uid: authUser.uid,
              ...userDocSnap.data(),
            } as UserProfile);
          } else {
            console.warn('User document not found in Firestore');
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    userProfile,
    loading,
    error,
    isAdmin: userProfile?.role === 'admin',
    isAuthenticated: !!user
  };
} 