// app.js
import {
  db, auth, collection, addDoc, getDocs, doc, updateDoc, arrayUnion,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "./firebase.js";

const authSection = document.getElementById("auth-section");
const tripSection = document.getElementById("trip-section");
const tripList = document.getElementById("tripList");

document.getElementById("registerBtn").onclick = async () => {
  const email = emailInput().value, password = passwordInput().value;
  await createUserWithEmailAndPassword(auth, email, password);
  alert("Registered!");
  showTripUI();
};

document.getElementById("loginBtn").onclick = async () => {
  const email = emailInput().value, password = passwordInput().value;
  await signInWithEmailAndPassword(auth, email, password);
  alert("Logged In!");
  showTripUI();
  loadTrips();
};

document.getElementById("createTripBtn").onclick = async () => {
  const name = document.getElementById("tripName").value;
  const totalBudget = +document.getElementById("tripBudget").value;
  await addDoc(collection(db, "trips"), {
    name, totalBudget, members: [], expenses: [], currency: "₹", locations: [], guidelines: ""
  });
  loadTrips();
};

function showTripUI() {
  authSection.style.display = "none";
  tripSection.style.display = "block";
}

function emailInput() {
  return document.getElementById("email");
}

function passwordInput() {
  return document.getElementById("password");
}

window.loadTrips = async () => {
  tripList.innerHTML = "";
  const snapshot = await getDocs(collection(db, "trips"));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data(), id = docSnap.id;
    const totalDeposits = data.members.reduce((sum, m) => sum + m.deposit, 0);
    const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const perPerson = data.members.length ? totalExpenses / data.members.length : 0;

    const li = document.createElement("li");
    li.className = "border p-4 rounded shadow bg-gray-50";

    li.innerHTML = `
      <h2 class="text-xl font-bold">${data.name}</h2>
      <p><strong>Currency:</strong> ${data.currency || "₹"}</p>
      <p><strong>Total Budget:</strong> ${data.currency}${data.totalBudget}</p>
      <p><strong>Total Deposits:</strong> ${data.currency}${totalDeposits}</p>
      <p><strong>Total Expenses:</strong> ${data.currency}${totalExpenses}</p>
      <p><strong>Per Person:</strong> ${data.currency}${perPerson.toFixed(2)}</p>

      <div class="mt-2">
        <input id="currency-${id}" placeholder="Set Currency (₹,$,€...)" class="border p-1 w-full mb-1"/>
        <button onclick="setCurrency('${id}')" class="bg-yellow-500 px-2 py-1 rounded text-white">Set Currency</button>
      </div>

      <div class="mt-3">
        <input id="member-${id}" placeholder="Friend Email" class="border p-1 w-full mb-1"/>
        <input id="deposit-${id}" type="number" placeholder="Deposit" class="border p-1 w-full mb-1"/>
        <button onclick="addMember('${id}')" class="bg-blue-500 px-2 py-1 text-white rounded">Add Member</button>
      </div>

      <div class="mt-3">
        <input id="expenseName-${id}" placeholder="Expense Name" class="border p-1 w-full mb-1"/>
        <input id="expenseAmount-${id}" type="number" placeholder="Amount" class="border p-1 w-full mb-1"/>
        <input id="paidBy-${id}" placeholder="Paid By (email)" class="border p-1 w-full mb-1"/>
        <button onclick="addExpense('${id}')" class="bg-red-500 px-2 py-1 text-white rounded">Add Expense</button>
      </div>

      <div class="mt-3">
        <input id="location-${id}" placeholder="Location Name" class="border p-1 w-full mb-1"/>
        <button onclick="addLocation('${id}')" class="bg-green-600 px-2 py-1 text-white rounded">Add Location</button>
        <ul class="mt-2 text-sm">
          ${data.locations.map((loc, i) => `
            <li>${loc.name} - 
              <span class="${loc.visited ? 'text-green-600' : 'text-gray-500'}">
                ${loc.visited ? 'Visited' : 'Pending'}
              </span>
              <button onclick="toggleVisited('${id}', ${i})" class="text-blue-600 underline ml-2 text-xs">Toggle</button>
            </li>
          `).join("") || "No locations added"}
        </ul>
      </div>

      <div class="mt-3">
        <textarea id="guide-${id}" placeholder="Add travel tips..." class="border p-2 w-full mb-2"></textarea>
        <button onclick="saveGuideline('${id}')" class="bg-indigo-600 text-white px-2 py-1 rounded">Save Guideline</button>
        <p class="text-sm mt-1">${data.guidelines || "No guidelines added"}</p>
      </div>
    `;

    tripList.appendChild(li);
  });
};

// All operations
window.setCurrency = async (tripId) => {
  const val = document.getElementById(`currency-${tripId}`).value;
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, { currency: val });
  loadTrips();
};

window.addMember = async (tripId) => {
  const email = document.getElementById(`member-${tripId}`).value;
  const deposit = +document.getElementById(`deposit-${tripId}`).value;
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, { members: arrayUnion({ email, deposit }) });
  loadTrips();
};

window.addExpense = async (tripId) => {
  const name = document.getElementById(`expenseName-${tripId}`).value;
  const amount = +document.getElementById(`expenseAmount-${tripId}`).value;
  const paidBy = document.getElementById(`paidBy-${tripId}`).value;
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, { expenses: arrayUnion({ name, amount, paidBy }) });
  loadTrips();
};

window.addLocation = async (tripId) => {
  const name = document.getElementById(`location-${tripId}`).value;
  const ref = doc(db, "trips", tripId);
  const snapshot = await getDocs(collection(db, "trips"));
  await updateDoc(ref, {
    locations: arrayUnion({ name, visited: false })
  });
  loadTrips();
};

window.toggleVisited = async (tripId, index) => {
  const tripRef = doc(db, "trips", tripId);
  const tripSnapshot = await getDocs(collection(db, "trips"));
  const data = tripSnapshot.docs.find(doc => doc.id === tripId).data();
  const locations = data.locations;
  locations[index].visited = !locations[index].visited;
  await updateDoc(tripRef, { locations });
  loadTrips();
};

window.saveGuideline = async (tripId) => {
  const guideText = document.getElementById(`guide-${tripId}`).value;
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, { guidelines: guideText });
  loadTrips();
};
