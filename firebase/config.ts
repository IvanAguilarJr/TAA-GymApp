import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "",
  authDomain: "taa01-eab87.firebaseapp.com",
  projectId: "taa01-eab87",
  storageBucket: "taa01-eab87.firebasestorage.app",
  messagingSenderId: "778760395898",
  appId: "1:778760395898:web:97ce71b9b02ede27f36fc3",
  measurementId: "G-DXJHW6R4NN",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

