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
        const { onAuthStateChanged } = await import('firebase/auth');
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
            
            // Create immediate temporary profile
            const immediateProfile: UserProfile = {
              uid: authUser.uid,
              email: authUser.email!,
              displayName: authUser.email?.split('@')[0] || 'User',
              role: 'admin',
              allowedModules: ['users', 'inventory', 'customers', 'sales', 'purchases', 'reports', 'settings', 'interaction', 'products', 'materials', 'parties', 'centers', 'stock', 'cash'],
              createdAt: Date.now(),
            };
            setUserProfile(immediateProfile);
            setLoading(false);
            
            // Fetch actual profile in background if db is available
            if (db) {
              try {
                const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                if (userDoc.exists()) {
                  setUserProfile(userDoc.data() as UserProfile);
                } else {
                  await setDoc(doc(db, 'users', authUser.uid), immediateProfile);
                }
              } catch (err) {
                console.warn('Background profile fetch failed:', err);
              }
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

  // Check module access
  const isAllowedModule = (moduleName: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.allowedModules?.includes(moduleName) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      error,
      signIn,
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
