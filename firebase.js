<script type="module">
  // Step 1: Import modules
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
  import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

  // Step 2: Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyCyIk56mSd_74ywFqKSVMwI9fma-zCGnbI",
    authDomain: "trip-budget-tracker-e36ad.firebaseapp.com",
    databaseURL: "https://trip-budget-tracker-e36ad-default-rtdb.firebaseio.com",
    projectId: "trip-budget-tracker-e36ad",
    storageBucket: "trip-budget-tracker-e36ad.appspot.com",
    messagingSenderId: "312674525838",
    appId: "1:312674525838:web:a9c23787900a9a88451fdf",
    measurementId: "G-5VB2GHHR3R"
  };

  // Step 3: Initialize app FIRST
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const auth = getAuth(app);

  // ✅ Now safe to use `app`
</script>
