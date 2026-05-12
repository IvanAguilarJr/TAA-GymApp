import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { ReactNativeAsyncStorage } from "@react-native-async-storage/async-storage";

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
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
