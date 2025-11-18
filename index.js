"use strict";

import express from 'express';
import keychainModule from './keychain.js';
const { Keychain } = keychainModule;

// --- NEW IMPORTS ---
// We need 'path' and 'fileURLToPath' to serve static files reliably
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3001;
app.use(express.json()); // Middleware to parse JSON bodies

// --- NEW STATIC SERVING CONFIG ---
// These lines tell Express to serve your 'public' folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));
// ---------------------------------

let activeKeychain = null;

// --- API Endpoints ---
// (All your /init, /load, /get, /set, /remove endpoints go here)
// (No changes needed to these)

/**
 * POST /init
 * Creates a new, empty keychain.
 */
app.post('/init', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).send({ error: 'Password is required' });
    }
    activeKeychain = await Keychain.init(password);
    const [repr, checksum] = await activeKeychain.dump();
    res.status(201).send({ repr, checksum });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});


/**
 * GET /get-all-names
 * Gets all the names (keys) from the loaded keychain.
 * Response: { "names": ["google.com", "github.com"] }
 */
app.get('/get-all-names', async (req, res) => {
  if (!activeKeychain) {
    return res.status(400).send({ error: 'No keychain is loaded.' });
  }
  
  try {
    const names = Object.keys(activeKeychain.secrets.vault);
    res.status(200).send({ names });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

/**
 * POST /load
 * Loads an existing keychain.
 */
app.post('/load', async (req, res) => {
  try {
    const { password, repr, trustedDataCheck } = req.body;
    if (!password || !repr) {
      return res.status(400).send({ error: 'Password and repr are required' });
    }
    activeKeychain = await Keychain.load(password, repr, trustedDataCheck);
    res.status(200).send({ message: 'Keychain loaded successfully' });
  } catch (error) {
    console.error(error);
    if (error.message.includes("Failed to decrypt")) {
      return res.status(401).send({ error: error.message });
    }
    res.status(500).send({ error: error.message });
  }
});

/**
 * GET /get
 * Gets a value from the loaded keychain.
 */
app.get('/get', async (req, res) => {
  try {
    if (!activeKeychain) {
      return res.status(400).send({ error: 'No keychain is loaded. Call /init or /load first.' });
    }
    const { name } = req.query;
    if (!name) {
      return res.status(400).send({ error: '"name" query parameter is required' });
    }
    const value = await activeKeychain.get(name);
    if (value === null) {
      return res.status(404).send({ error: 'Name not found' });
    }
    res.status(200).send({ name, value });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

/**
 * POST /set
 * Sets a value in the loaded keychain.
 */
app.post('/set', async (req, res) => {
  try {
    if (!activeKeychain) {
      return res.status(400).send({ error: 'No keychain is loaded. Call /init or /load first.' });
    }
    const { name, value } = req.body;
    if (!name || value === undefined) {
      return res.status(400).send({ error: '"name" and "value" are required' });
    }
    await activeKeychain.set(name, value);
    const [repr, checksum] = await activeKeychain.dump();
    res.status(200).send({ repr, checksum });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

/**
 * POST /remove
 * Removes a value from the loaded keychain.
 */
app.post('/remove', async (req, res) => {
  try {
    if (!activeKeychain) {
      return res.status(400).send({ error: 'No keychain is loaded. Call /init or /load first.' });
    }
    const { name } = req.body;
    if (!name) {
      return res.status(400).send({ error: '"name" is required' });
    }
    const wasRemoved = await activeKeychain.remove(name);
    if (!wasRemoved) {
      return res.status(404).send({ error: 'Name not found' });
    }
    const [repr, checksum] = await activeKeychain.dump();
    res.status(200).send({ repr, checksum });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});


// --- Server ---
app.listen(port, () => {
  console.log(`Password Manager API listening at http://localhost:${port}`);
  console.log(`Frontend accessible at http://localhost:${port}`);
});