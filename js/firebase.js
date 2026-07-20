import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCa9kdTAkUGpMHCogDqzxQ_JMeIRNfA3UQ",
    authDomain: "app-nutri-a5d1d.firebaseapp.com",
    projectId: "app-nutri-a5d1d",
    storageBucket: "app-nutri-a5d1d.firebasestorage.app",
    messagingSenderId: "535863969260",
    appId: "1:535863969260:web:53715b9bd0351f4810acc9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);