import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDPSZJVtWvXeRUi9ONLoZ1FuxxwTI3eGB0",
  authDomain: "hospital-management-syst-79313.firebaseapp.com",
  projectId: "hospital-management-syst-79313",
  storageBucket: "hospital-management-syst-79313.firebasestorage.app",
  messagingSenderId: "918197590782",
  appId: "1:918197590782:web:faf263d603a036f27da3af"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;