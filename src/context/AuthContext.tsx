'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Define user role type
export type UserRole = 'admin' | 'staff' | 'audiologist';

// Define user profile type
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  allowedModules?: string[];
  createdAt: number;
  branchId?: string;
}

// Auth context interface
interface AuthContextInterface {
  user: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  createUser: (email: string, password: string, role: UserRole, displayName?: string, allowedModules?: string[], branchId?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeEmail: (newEmail: string, password: string) => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  updateUserPassword: (uid: string, newPassword: string) => Promise<void>;
  updateUserEmail: (uid: string, newEmail: string) => Promise<void>;
  resetError: () => void;
  isAllowedModule: (moduleName: string) => boolean;
}

// Create the auth context
const AuthContext = createContext<AuthContextInterface>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  createUser: async () => {},
  changePassword: async () => {},
  changeEmail: async () => {},
  resetUserPassword: async () => {},
  updateUserPassword: async () => {},
  updateUserEmail: async () => {},
  resetError: () => {},
  isAllowedModule: () => false,
});

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();

  // Initialize auth listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // Dynamic import to prevent bundling issues
        const firebaseModule = await import('../firebase/config');
        const { auth, db } = firebaseModule;
        const { onAuthStateChanged, signOut: firebaseSignOut } = await import('firebase/auth');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        
        if (!auth) {
          console.error('Firebase Auth not initialized');
          setError('Firebase configuration error');
          setLoading(false);
          return;
        }
        
        unsubscribe = onAuthStateChanged(auth, async (authUser) => {
          if (authUser) {
            setUser(authUser);

            // Security: ONLY allow users that already exist in Firestore `users/{uid}`.
            // Never auto-create admin profiles (this was making every login an admin).
            if (!db) {
              await firebaseSignOut(auth);
              setUser(null);
              setUserProfile(null);
              setError('Database not available. Please try again.');
              setLoading(false);
              router.push('/login');
              return;
            }

            try {
              const userDoc = await getDoc(doc(db, 'users', authUser.uid));
              if (!userDoc.exists()) {
                await firebaseSignOut(auth);
                setUser(null);
                setUserProfile(null);
                setError('Not authorized. Ask admin to add your user first.');
                setLoading(false);
                router.push('/login');
                return;
              }

              setUserProfile(userDoc.data() as UserProfile);
              setLoading(false);
            } catch (err) {
              console.warn('Profile fetch failed:', err);
              await firebaseSignOut(auth);
              setUser(null);
              setUserProfile(null);
              setError('Failed to load your access profile. Please try again.');
              setLoading(false);
              router.push('/login');
              return;
            }
          } else {
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            
            if (pathname !== '/login' && pathname !== '/') {
              router.push('/login');
            }
          }
        });
        
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Firebase initialization failed');
        setLoading(false);
      }
    };
    
    initAuth();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router, pathname]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { auth } = await import('../firebase/config');
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  // Google sign-in (restricted to users already present in Firestore `users` by email)
  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);

      const { auth, db } = await import('../firebase/config');
      const { GoogleAuthProvider, signInWithPopup, signOut: firebaseSignOut } = await import('firebase/auth');
      const { collection, query, where, getDocs, doc, getDoc, setDoc } = await import('firebase/firestore');

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      const authUser = cred.user;

      const email = (authUser.email || '').toLowerCase().trim();
      if (!email) {
        await firebaseSignOut(auth);
        throw new Error('Google account has no email. Please use email/password login.');
      }

      if (!db) {
        // If DB isn't available we can't enforce allowlist safely.
        await firebaseSignOut(auth);
        throw new Error('Database not available. Please try again later.');
      }

      // If profile already exists for this UID, allow.
      const byUidRef = doc(db, 'users', authUser.uid);
      const byUidSnap = await getDoc(byUidRef);
      if (!byUidSnap.exists()) {
        // Otherwise, allow ONLY if a user record exists with this email (admin-created allowlist).
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        if (snap.empty) {
          await firebaseSignOut(auth);
          throw new Error('This Google account is not authorized. Ask admin to add you first.');
        }

        const existing = snap.docs[0];
        const existingData: any = existing.data();

        // Create a new profile for the Google UID, copying permissions from the allowlisted record.
        const migratedProfile: UserProfile = {
          uid: authUser.uid,
          email,
          displayName: authUser.displayName || existingData.displayName || email.split('@')[0],
          role: existingData.role || 'staff',
          allowedModules: existingData.allowedModules || [],
          createdAt: existingData.createdAt || Date.now(),
          branchId: existingData.branchId,
        };

        await setDoc(byUidRef, {
          ...migratedProfile,
          migratedFromUid: existing.id,
          authProvider: 'google',
          updatedAt: Date.now(),
        } as any, { merge: true });

        // Keep the old doc for history, but mark it as migrated.
        await setDoc(doc(db, 'users', existing.id), {
          migratedToUid: authUser.uid,
          migratedAt: Date.now(),
        } as any, { merge: true });
      }

      router.push('/dashboard');
      setLoading(false);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
      throw err;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      const { auth } = await import('../firebase/config');
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  // Create user function
  const createUser = async (
    email: string, 
    password: string, 
    role: UserRole,
    displayName?: string,
    allowedModules?: string[],
    branchId?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const { auth, db } = await import('../firebase/config');
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      const userProfile: UserProfile = {
        uid: newUser.uid,
        email: newUser.email!,
        displayName: displayName || email.split('@')[0],
        role,
        allowedModules: allowedModules || [],
        createdAt: Date.now(),
        branchId,
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userProfile);
      setLoading(false);
    } catch (err: any) {
      console.error('Create user error:', err);
      setError(err.message || 'Failed to create user');
      setLoading(false);
    }
  };

  // Change password for current user
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setError(null);
      setLoading(true);
      
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // Validate password strength
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }

      const { auth } = await import('../firebase/config');
      const { signInWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Change password error:', err);
      setError(err.message || 'Failed to change password');
      setLoading(false);
      throw err;
    }
  };

  // Change email for current user
  const changeEmail = async (newEmail: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        throw new Error('Invalid email format');
      }

      const { auth } = await import('../firebase/config');
      const { updateEmail, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      
      // Re-authenticate user with password
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      // Update email
      await updateEmail(user, newEmail);
      
      // Update email in Firestore user profile
      const { db } = await import('../firebase/config');
      if (db) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', user.uid), {
          email: newEmail,
          updatedAt: Date.now(),
        });
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Change email error:', err);
      setError(err.message || 'Failed to change email');
      setLoading(false);
      throw err;
    }
  };

  // Send password reset email to user
  const resetUserPassword = async (email: string) => {
    try {
      setError(null);
      setLoading(true);
      
      const { auth } = await import('../firebase/config');
      const { sendPasswordResetEmail } = await import('firebase/auth');
      
      await sendPasswordResetEmail(auth, email);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to send password reset email');
      setLoading(false);
      throw err;
    }
  };

  // Update user password (admin only - requires Firebase Admin SDK or custom function)
  // Note: This requires a Cloud Function or Admin SDK as Firebase client SDK doesn't allow
  // changing other users' passwords directly. We'll store the request in Firestore for a Cloud Function to process.
  const updateUserPassword = async (uid: string, newPassword: string) => {
    try {
      setError(null);
      setLoading(true);
      
      // Validate password strength
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }

      // Store password update request in Firestore for Cloud Function to process
      // This is a workaround since client SDK can't directly update other users' passwords
      const { db } = await import('../firebase/config');
      if (db) {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(db, 'passwordUpdateRequests', `${uid}_${Date.now()}`), {
          uid,
          newPassword, // In production, this should be encrypted or handled server-side
          requestedBy: user?.uid,
          requestedAt: serverTimestamp(),
          status: 'pending',
        });
      } else {
        throw new Error('Database not available. Please use password reset email instead.');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Update user password error:', err);
      setError(err.message || 'Failed to update user password');
      setLoading(false);
      throw err;
    }
  };

  // Update user email (admin only - requires Firebase Admin SDK or custom function)
  // Note: This requires a Cloud Function or Admin SDK as Firebase client SDK doesn't allow
  // changing other users' emails directly. We'll update Firestore and let Cloud Function handle Auth.
  const updateUserEmail = async (uid: string, newEmail: string) => {
    try {
      setError(null);
      setLoading(true);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        throw new Error('Invalid email format');
      }

      // Update email in Firestore (Auth update requires Admin SDK/Cloud Function)
      const { db } = await import('../firebase/config');
      if (db) {
        const { doc, updateDoc, serverTimestamp, setDoc: setDocRequest } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', uid), {
          email: newEmail,
          updatedAt: serverTimestamp(),
          emailUpdatedBy: user?.uid,
        });
        
        // Store email update request for Cloud Function to process Auth update
        await setDocRequest(doc(db, 'emailUpdateRequests', `${uid}_${Date.now()}`), {
          uid,
          newEmail,
          requestedBy: user?.uid,
          requestedAt: serverTimestamp(),
          status: 'pending',
        });
      } else {
        throw new Error('Database not available');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Update user email error:', err);
      setError(err.message || 'Failed to update user email');
      setLoading(false);
      throw err;
    }
  };

  // Reset error
  const resetError = () => {
    setError(null);
  };

  // Module keys that staff can access (aligned with layout staffAllowedModules)
  const STAFF_ALLOWED_MODULE_KEYS = [
    'dashboard', 'products', 'sales', 'interaction', 'stock transfer', 'inventory',
    'materials', 'deliveries', 'material in', 'material out', 'cash register',
    'appointment scheduler', 'appointments',
  ];
  // Module keys that audiologist can access (aligned with layout audiologistAllowedModules)
  const AUDIOLOGIST_ALLOWED_MODULE_KEYS = [
    'dashboard', 'products', 'inventory', 'appointment scheduler', 'appointments', 'interaction',
  ];

  // Check module access: admin sees all; staff/audiologist use role-based lists; others use profile allowedModules
  const isAllowedModule = (moduleName: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    const key = moduleName.toLowerCase().trim();
    if (userProfile.role === 'staff') {
      return STAFF_ALLOWED_MODULE_KEYS.includes(key);
    }
    if (userProfile.role === 'audiologist') {
      return AUDIOLOGIST_ALLOWED_MODULE_KEYS.includes(key);
    }
    return userProfile.allowedModules?.includes(moduleName) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      error,
      signIn,
      signInWithGoogle,
      signOut,
      createUser,
      changePassword,
      changeEmail,
      resetUserPassword,
      updateUserPassword,
      updateUserEmail,
      resetError,
      isAllowedModule,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}
