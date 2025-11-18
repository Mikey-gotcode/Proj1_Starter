"use strict";

// --- GLOBAL VARIABLES ---
let clientVault = {
  repr: null,
  checksum: null
};

// Find the grid where password cards will go
let passwordGrid = null; // Will be set on DOMContentLoaded


// --- MAIN FUNCTIONS ---

// This function runs as soon as the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('VaultGuardian frontend loaded.');
  
  // Find the grid container
  passwordGrid = document.querySelector('.grid.gap-6');
  
  // Find the "Add Password" button
  const addPasswordButton = document.querySelector('button.bg-blue-600');
  if (addPasswordButton) {
    addPasswordButton.addEventListener('click', handleAddPassword);
  }

  // The most important step: Load or create the vault
  loadOrCreateVault();
});

/**
 * Checks localStorage for a vault.
 * - If found, prompts user to unlock it (calls /load).
 * - If not found, prompts user to create one (calls /init).
 */
async function loadOrCreateVault() {
  const storedVault = localStorage.getItem('vaultGuardianVault');

  if (storedVault) {
    // --- VAULT EXISTS: LOAD IT ---
    const password = prompt('Enter your master password to unlock your vault:');
    if (!password) return;

    try {
      const parsedVault = JSON.parse(storedVault);
      
      const response = await fetch('/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          repr: parsedVault.repr,
          trustedDataCheck: parsedVault.checksum
        })
      });

      if (response.status === 401) {
        alert('Failed to decrypt: Invalid password.');
        return;
      }
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      // SUCCESS! Save to in-memory variable
      clientVault.repr = parsedVault.repr;
      clientVault.checksum = parsedVault.checksum;
      
      alert('Vault unlocked!');
      
      // *** NEW: Fetch and render all saved passwords ***
      fetchAndRenderAllPasswords();

    } catch (error) {
      console.error('Failed to load vault:', error);
      alert('Failed to load vault. It might be corrupted.');
    }

  } else {
    // --- NO VAULT: CREATE ONE ---
    const password = prompt('No vault found. Enter a new master password to create one:');
    if (!password) return;

    try {
      const response = await fetch('/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json(); // { repr, checksum }

      // Save the new vault to localStorage
      localStorage.setItem('vaultGuardianVault', JSON.stringify(data));
      clientVault.repr = data.repr;
      clientVault.checksum = data.checksum;

      alert('New vault created and saved!');

      // *** NEW: Clear the static mock data ***
      clearPasswordGrid(); 

    } catch (error) {
      console.error('Failed to init vault:', error);
      alert('Failed to initialize vault.');
    }
  }
}

// --- UI RENDERING FUNCTIONS ---

/**
 * Fetches all password names from the server and renders them
 */
async function fetchAndRenderAllPasswords() {
  if (!clientVault.repr) return; // Don't fetch if vault isn't loaded
  
  try {
    const response = await fetch('/get-all-names');
    if (!response.ok) {
      throw new Error('Failed to fetch password names');
    }
    const { names } = await response.json();
    
    clearPasswordGrid(); // Clear mock data
    names.forEach(name => {
      renderPasswordCard(name); // Render one card for each name
    });

  } catch (error) {
    console.error(error);
    alert('Could not load password list.');
  }
}

/**
 * Clears all static/existing password cards from the grid
 */
function clearPasswordGrid() {
  if (passwordGrid) {
    passwordGrid.innerHTML = ''; // Remove all children (the mock cards)
  }
}

/**
 * Renders a single password card in the grid
 * @param {string} name - The name of the password entry (e.g., "google.com")
 */
function renderPasswordCard(name) {
  if (!passwordGrid) return;
  
  // Note: Your UI has "username", but the keychain only saves name/value.
  // We'll create a simplified card.
  const cardHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">${name}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Click 'View' to see password</p>
      
      <div class="flex justify-end gap-2 mt-4">
        <button class="text-blue-600 hover:text-blue-800 flex items-center gap-1" onclick="handleViewPassword('${name}')">
          <i data-feather="eye" class="w-4 h-4"></i> View
        </button>
        <button class="text-red-600 hover:text-red-800 flex items-center gap-1" onclick="handleRemovePassword('${name}')">
          <i data-feather="trash-2" class="w-4 h-4"></i> Delete
        </button>
      </div>
    </div>
  `;
  
  // Add the new card HTML to the grid
  passwordGrid.insertAdjacentHTML('beforeend', cardHTML);
  
  // We must call feather.replace() again to render the new icons
  feather.replace();
}


// --- BUTTON HANDLER FUNCTIONS ---

/**
 * Handles clicking the "Add Password" button
 */
async function handleAddPassword() {
  if (clientVault.repr === null) {
    alert('Please unlock or create your vault first.');
    return loadOrCreateVault();
  }
  
  const name = prompt('Enter the name (e.g., "Google"):');
  const value = prompt('Enter the password:');

  if (!name || !value) {
    alert('Name and value are required.');
    return;
  }

  try {
    const response = await fetch('/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json(); // { repr, checksum }

    // CRITICAL: Save the *new* encrypted vault state
    localStorage.setItem('vaultGuardianVault', JSON.stringify(data));
    clientVault.repr = data.repr;
    clientVault.checksum = data.checksum;

    alert(`Saved password for "${name}"!`);
    
    // *** NEW: Immediately render the new card ***
    renderPasswordCard(name);

  } catch (error) {
    console.error('Failed to set password:', error);
    alert('Failed to save password.');
  }
}

/**
 * Handles clicking the "View" button on a card
 */
async function handleViewPassword(name) {
  try {
    const response = await fetch(`/get?name=${encodeURIComponent(name)}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to get password');
    }
    const { value } = await response.json();
    alert(`Password for "${name}":\n\n${value}`);
  } catch (error) {
    console.error('Failed to get password:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Handles clicking the "Delete" button on a card
 */
async function handleRemovePassword(name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    const response = await fetch('/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to remove password');
    }
    
    const data = await response.json(); // { repr, checksum }

    // CRITICAL: Save the *new* vault state
    localStorage.setItem('vaultGuardianVault', JSON.stringify(data));
    clientVault.repr = data.repr;
    clientVault.checksum = data.checksum;

    alert(`"${name}" has been removed.`);
    
    // Refresh the whole UI (the easiest way to remove the card)
    fetchAndRenderAllPasswords();

  } catch (error) {
    console.error('Failed to remove password:', error);
    alert(`Error: ${error.message}`);
  }
}