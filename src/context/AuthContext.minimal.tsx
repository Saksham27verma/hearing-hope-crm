'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  user: any | null;
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
