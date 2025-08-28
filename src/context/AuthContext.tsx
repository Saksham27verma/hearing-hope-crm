'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useRouter, usePathname } from 'next/navigation';

// Define user role type
export type UserRole = 'admin' | 'staff';

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
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createUser: (email: string, password: string, role: UserRole, displayName?: string, allowedModules?: string[], branchId?: string) => Promise<void>;
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
  resetError: () => {},
  isAllowedModule: () => false,
});

// Auth Provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false); // Start with false for faster initial load
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      console.error('Firebase Auth not initialized');
      setError('Firebase configuration error');
      setLoading(false);
      return;
    }
    
    setLoading(true); // Set loading only when auth listener starts
    
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        
        // Create immediate temporary profile to avoid loading delays
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
        
        // Fetch/create actual profile in background (non-blocking)
        if (db) {
          try {
            const userDoc = await getDoc(doc(db, 'users', authUser.uid));
            
            if (userDoc.exists()) {
              setUserProfile(userDoc.data() as UserProfile);
            } else {
              // Create profile in Firestore for future use
              await setDoc(doc(db, 'users', authUser.uid), immediateProfile);
            }
          } catch (err) {
            console.warn('Background profile fetch/create failed:', err);
            // Continue with immediate profile
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        
        // Redirect to login if not on login page and not authenticated
        // But don't redirect if user is on enquiry form pages (they might be loading)
        if (pathname !== '/login' && pathname !== '/' && 
            !pathname.startsWith('/interaction/enquiries/')) {
          router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      // Don't set loading here, let onAuthStateChanged handle it
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
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  // Create new user function (admin only)
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
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      // Create user profile in Firestore
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

  // Reset error state
  const resetError = () => {
    setError(null);
  };

  // Check if user is allowed to access a module
  const isAllowedModule = (moduleName: string) => {
    if (!userProfile) return false;
    
    // Admin has access to all modules
    if (userProfile.role === 'admin') return true;
    
    // Staff has access to specific modules
    return userProfile.allowedModules?.includes(moduleName) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        signIn,
        signOut,
        createUser,
        resetError,
        isAllowedModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext); 