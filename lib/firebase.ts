import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAXRr-EcwZNQ41xkLQxPARpBbnhgZCHbTA",
  authDomain: "smartread-app.firebaseapp.com",
  projectId: "smartread-app",
  storageBucket: "smartread-app.firebasestorage.app",
  messagingSenderId: "111367447822",
  appId: "1:111367447822:web:38bad0abd41497d80e235f",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const functions = getFunctions(app);
