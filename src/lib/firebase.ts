import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});

// Initialize Firestore using databaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

// Validate connection on startup as required by the Firebase Integration Skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firebase connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("client is offline")) {
      console.error("Please check your Firebase configuration.");
    } else {
      console.log("Firebase initialized (test collection is empty or rules block it, which is normal).");
    }
  }
}
testConnection();
