"use strict";

/********* External Imports ********/

// Use import for ES Modules
import { stringToBuffer, bufferToString, encodeBuffer, decodeBuffer, getRandomBytes } from "./lib.js";
import { webcrypto } from 'node:crypto';
const { subtle } = webcrypto;

/********* Constants ********/

const PBKDF2_ITERATIONS = 100000; // number of iterations for PBKDF2 algorithm
const MAX_PASSWORD_LENGTH = 64;   // we can assume no password is longer than this many characters

/********* Implementation ********/
class Keychain {
  /**
   * Initializes the keychain. (Private constructor)
   */
  constructor(salt, encKey) {
    this.data = {
      salt: encodeBuffer(salt)
    };
    this.secrets = {
      encKey: encKey,
      vault: {} // This object will store the domain:password pairs
    };
  };

  /**
    * Derives an encryption key from a password and salt using PBKDF2.
    * (Private static method)
    */
  static async #deriveKey(password, salt) {
    const passwordKey = await subtle.importKey(
      "raw",
      stringToBuffer(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const encKey = await subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      passwordKey,
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );

    return encKey;
  }

  /**
    * Creates an empty keychain with the given password.
    */
  static async init(password) {
    const salt = getRandomBytes(16);
    const encKey = await Keychain.#deriveKey(password, salt);
    return new Keychain(salt, encKey);
  }

  /**
    * Loads the keychain state from the provided representation (repr).
    */
  static async load(password, repr, trustedDataCheck) {
    if (trustedDataCheck) {
      const checksumBuffer = await subtle.digest("SHA-256", stringToBuffer(repr));
      const computedChecksum = encodeBuffer(checksumBuffer);
      if (computedChecksum !== trustedDataCheck) {
        throw new Error("Integrity check failed: Checksum does not match!");
      }
    }

    const reprObj = JSON.parse(repr);
    const salt = decodeBuffer(reprObj.salt);
    const iv = decodeBuffer(reprObj.iv);
    const ciphertext = decodeBuffer(reprObj.ciphertext);

    const encKey = await Keychain.#deriveKey(password, salt);

    let decryptedBuffer;
    try {
      decryptedBuffer = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        encKey,
        ciphertext
      );
    } catch (e) {
      throw new Error("Failed to decrypt: Invalid password or corrupted data.");
    }

    const vaultString = bufferToString(decryptedBuffer);
    const vault = JSON.parse(vaultString);

    const keychain = new Keychain(salt, encKey);
    keychain.secrets.vault = vault;
    return keychain;
  };

  /**
    * Returns a JSON serialization of the contents of the keychain.
    */
  async dump() {
    const vaultString = JSON.stringify(this.secrets.vault);
    const iv = getRandomBytes(12);

    const ciphertext = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      this.secrets.encKey,
      stringToBuffer(vaultString)
    );

    const repr = {
      salt: this.data.salt,
      iv: encodeBuffer(iv),
      ciphertext: encodeBuffer(ciphertext)
    };

    const reprString = JSON.stringify(repr);

    const checksumBuffer = await subtle.digest("SHA-256", stringToBuffer(reprString));
    const checksum = encodeBuffer(checksumBuffer);

    return [reprString, checksum];
  };

  /**
    * Fetches the data (as a string) corresponding to the given domain.
    */
  async get(name) {
    return this.secrets.vault[name] || null;
  };

  /**
  * Inserts the domain and associated data into the KVS.
  */
  async set(name, value) {
    this.secrets.vault[name] = value;
  };

  /**
    * Removes the record with name from the password manager.
  */
  async remove(name) {
    if (name in this.secrets.vault) {
      delete this.secrets.vault[name];
      return true;
    }
    return false;
  };
};

// Use export default to match your file's structure
export default { Keychain }