import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Firestore users doc: name, email, role
  const [loading, setLoading] = useState(true);

  // Login with email and password
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Login with Google
  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  // Logout
  function logout() {
    return signOut(auth);
  }

  // Change password (requires re-authentication with current password)
  async function changePassword(currentPassword, newPassword) {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    return updatePassword(currentUser, newPassword);
  }

  // Ensure a users/{uid} document exists and load the role.
  async function loadUserData(user) {
    const userRef = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        setUserData({ id: snap.id, ...snap.data() });
      } else {
        // First login: create the profile. Default role is admin so the
        // first account can configure the system; adjust in Firestore as needed.
        const profile = {
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          role: 'admin',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        };
        await setDoc(userRef, profile);
        setUserData({ id: user.uid, ...profile });
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setUserData({ id: user.uid, name: user.displayName || user.email, email: user.email, role: 'admin' });
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserData(user);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    currentUser,
    userData,
    userRole: userData?.role || 'admin',
    login,
    loginWithGoogle,
    logout,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
