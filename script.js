// =================================================================================
// GENERAL APP LOGIC (Dashboard, Chat, Reminders) - UPDATED & MORE ROBUST
// =================================================================================
const app = {
    currentUser: null,
    groupData: null,
    chatPollInterval: null,

    init: async () => { // Make the initializer async
        app.currentUser = getCurrentUser();
        if (!app.currentUser) {
            const isAuthPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html');
            if (!isAuthPage) {
                window.location.href = 'index.html';
            }
            return;
        }

        // General UI setup
        app.setupCommonUI();
        
        // Await the crucial data load before proceeding
        await app.loadGroupData(); 
        
        if (!app.groupData) {
            console.error("Failed to load group data. Halting page-specific initialization.");
            showToast("Could not load trip data. Please refresh.", "error");
            return; // Stop execution if we can't get group data
        }

        // Page-specific initializations now run *after* data is loaded
        const path = window.location.pathname;
        if (path.endsWith('/dashboard.html')) {
            app.initDashboard();
        } else if (path.endsWith('/chat.html')) {
            app.initChat();
        } else if (path.endsWith('/reminder.html')) {
            app.initRemindersPage();
        }
    },

    setupCommonUI: () => {
        document.getElementById('logout-btn')?.addEventListener('click', app.handleLogout);

        const menuBtn = document.getElementById('menu-btn');
        const sidebar = document.getElementById('sidebar');
        
        if(menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                const isClosed = sidebar.classList.contains('-translate-x-full');
                menuBtn.innerHTML = isClosed 
                    ? `<i data-lucide="menu" class="w-6 h-6"></i>` 
                    : `<i data-lucide="x" class="w-6 h-6"></i>`;
                lucide.createIcons();
            });
        }
        
        // Set user/group name in headers if available
        const usernameHeader = document.getElementById('username-header');
        if (usernameHeader) usernameHeader.textContent = app.currentUser?.username || 'User';
    },

    loadGroupData: async () => {
        if (!app.currentUser?.groupId) return;
        app.groupData = await firebaseGet(`groups/${app.currentUser.groupId}`);
        if(app.groupData) {
            const groupNameHeader = document.getElementById('group-name-header');
            if(groupNameHeader) groupNameHeader.textContent = app.groupData.groupName || 'My Trip';
        }
    },
    
    handleLogout: () => {
        sessionStorage.removeItem('currentUser');
        if (app.chatPollInterval) clearInterval(app.chatPollInterval);
        showToast("You have been logged out.", "success");
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    },

    // -----------------------------------------------------------------------------
    // DASHBOARD
    // -----------------------------------------------------------------------------
    initDashboard: () => {
        if (!app.groupData) return;

        // Populate dashboard sections
        app.renderFriends();
        app.renderExpenses();
        app.calculateSummary();
        app.renderDashboardReminders();

        // Setup event listeners
        document.getElementById('add-friend-btn')?.addEventListener('click', app.addFriend);
        document.getElementById('add-expense-btn')?.addEventListener('click', app.showExpenseModal);
        document.getElementById('cancel-expense-btn')?.addEventListener('click', app.hideExpenseModal);
        document.getElementById('add-expense-form')?.addEventListener('submit', app.addExpense);
        document.getElementById('export-csv-btn')?.addEventListener('click', app.exportExpensesToCSV);
        document.getElementById('add-reminder-btn')?.addEventListener('click', app.addDashboardReminder);
    },

    renderFriends: () => {
        const list = document.getElementById('friends-list');
        if(!list) return;
        list.innerHTML = '';
        const members = app.groupData.members || {};
        for (const emailKey in members) {
            const member = members[emailKey];
            const isOrganizer = emailKey === app.groupData.organizer;
            const friendHTML = `
                <div class="flex flex-col items-center group relative text-center">
                    <img src="assets/images/${member.avatar || 'avatar1.png'}" class="w-16 h-16 rounded-full border-2 border-gray-600 object-cover">
                    <span class="mt-2 text-sm w-20 truncate">${member.name}</span>
                    ${!isOrganizer && encodeEmail(app.currentUser.email) === app.groupData.organizer ? `<button data-email="${emailKey}" class="remove-friend-btn absolute -top-1 -right-1 btn-icon bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
                </div>
            `;
            list.insertAdjacentHTML('beforeend', friendHTML);
        }
        lucide.createIcons();
        document.querySelectorAll('.remove-friend-btn').forEach(btn => btn.addEventListener('click', app.removeFriend));
    },

    addFriend: async () => {
        const friendEmail = prompt("Enter friend's email to add them to the trip:");
        if (!friendEmail) return;

        const encodedFriendEmail = encodeEmail(friendEmail);
        const friendUser = await firebaseGet(`users/${encodedFriendEmail}`);

        if (!friendUser) {
            showToast("User not found.", "error");
            return;
        }

        if (app.groupData.members && app.groupData.members[encodedFriendEmail]) {
            showToast("This user is already in the trip.", "error");
            return;
        }

        // Add friend to the current user's group
        const newMember = { name: friendUser.username, avatar: `avatar${(Object.keys(app.groupData.members || {}).length % 3) + 1}.png` };
        await firebaseSet(`groups/${app.currentUser.groupId}/members/${encodedFriendEmail}`, newMember);

        // Update the friend's user object to join this group
        await firebaseSet(`users/${encodedFriendEmail}/groupId`, app.currentUser.groupId);

        showToast(`${friendUser.username} has been added to the trip!`, "success");
        await app.loadGroupData();
        app.renderFriends();
    },

    removeFriend: async (e) => {
        const friendEmailKey = e.currentTarget.dataset.email;
        if (!confirm(`Are you sure you want to remove this friend? This will reset their trip association.`)) return;

        await firebaseDelete(`groups/${app.currentUser.groupId}/members/${friendEmailKey}`);
        
        // Remove groupId from the user's object so they are no longer in the trip
        await firebaseSet(`users/${friendEmailKey}/groupId`, "");

        showToast("Friend removed from the trip.", "success");
        await app.loadGroupData();
        app.renderFriends();
    },

    renderExpenses: () => {
        const list = document.getElementById('expenses-list');
        if(!list) return;
        list.innerHTML = '<p class="text-gray-400 text-center py-4">No expenses added yet.</p>';
        const expenses = app.groupData.expenses || {};
        if (Object.keys(expenses).length > 0) list.innerHTML = '';

        Object.entries(expenses).sort(([,a],[,b]) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(([id, expense]) => {
            const paidByMember = app.groupData.members[expense.paidBy]?.name || 'Unknown';
            const canDelete = expense.paidBy === encodeEmail(app.currentUser.email) || app.groupData.organizer === encodeEmail(app.currentUser.email);
            const expenseHTML = `
                <div class="flex justify-between items-center bg-gray-800 p-3 rounded-lg group">
                    <div>
                        <p class="font-semibold">${expense.description}</p>
                        <p class="text-sm text-gray-400">Paid by ${paidByMember}</p>
                    </div>
                    <div class="text-right flex items-center gap-4">
                        <p class="font-bold text-lg text-pink-400">₹${Number(expense.amount).toFixed(2)}</p>
                         ${canDelete ? `<button data-id="${id}" class="remove-expense-btn text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>` : ''}
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', expenseHTML);
        });
        lucide.createIcons();
        document.querySelectorAll('.remove-expense-btn').forEach(btn => btn.addEventListener('click', app.removeExpense));
    },

    showExpenseModal: () => {
        const modal = document.getElementById('add-expense-modal');
        const splitMembersDiv = document.getElementById('expense-split-members');
        if(!modal || !splitMembersDiv) return;
        splitMembersDiv.innerHTML = '';
        
        Object.entries(app.groupData.members).forEach(([emailKey, member]) => {
            const checkboxHTML = `
                <label class="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" value="${emailKey}" class="split-member-checkbox form-checkbox" checked>
                    <span>${member.name}</span>
                </label>
            `;
            splitMembersDiv.insertAdjacentHTML('beforeend', checkboxHTML);
        });

        modal.classList.remove('hidden');
    },

    hideExpenseModal: () => {
        const modal = document.getElementById('add-expense-modal');
        const form = document.getElementById('add-expense-form');
        if(modal) modal.classList.add('hidden');
        if(form) form.reset();
    },

    addExpense: async (e) => {
        e.preventDefault();
        const description = document.getElementById('expense-description').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        
        const selectedMembers = Array.from(document.querySelectorAll('.split-member-checkbox:checked'))
            .map(cb => cb.value);

        if (!description || !amount || selectedMembers.length === 0) {
            showToast("Please fill all fields and select at least one member.", "error");
            return;
        }
