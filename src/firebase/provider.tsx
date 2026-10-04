'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { app, auth, firestore, getFirebaseInstances } from './config';

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    const { auth: activeAuth } = getFirebaseInstances();

    if (!activeAuth) {
      console.warn("Firebase Auth is not initialized.");
      setUserAuthState({ user: null, isUserLoading: false, userError: null });
      return;
    }

    // استخدام الـ auth المستقر
    const unsubscribe = onAuthStateChanged(
      activeAuth,
      (firebaseUser) => {
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        console.error("FirebaseProvider Error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    
    return () => unsubscribe();
  }, []);

  const contextValue = useMemo((): FirebaseContextState => {
    const { app: activeApp, firestore: activeFirestore, auth: activeAuth } = getFirebaseInstances();
    return {
      firebaseApp: (activeApp || app) as FirebaseApp,
      firestore: (activeFirestore || firestore) as Firestore,
      auth: (activeAuth || auth) as Auth,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    const { app: activeApp, firestore: activeFirestore, auth: activeAuth } = getFirebaseInstances();
    return {
      firebaseApp: (activeApp || app) as FirebaseApp,
      firestore: (activeFirestore || firestore) as Firestore,
      auth: (activeAuth || auth) as Auth,
      user: null,
      isUserLoading: false,
      userError: null
    };
  }
  return context;
};

export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().firestore;
export const useFirebaseApp = (): FirebaseApp => useFirebase().firebaseApp;
export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps) as any;
  if(memoized && typeof memoized === 'object') {
    memoized.__memo = true;
  }
  return memoized;
}
