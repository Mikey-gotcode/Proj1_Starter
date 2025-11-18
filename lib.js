"use strict";

import { webcrypto } from 'node:crypto';

/**
 * Converts a string to a Uint8Array buffer.
 * @param {string} str - The string to convert.
 * @returns {Uint8Array}
 */
export function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

/**
 * Converts an ArrayBuffer or Uint8Array to a string.
 * @param {ArrayBuffer | Uint8Array} buf - The buffer to convert.
 * @returns {string}
 */
export function bufferToString(buf) {
  return new TextDecoder().decode(buf);
}

/**
 * Encodes an ArrayBuffer or Uint8Array into a Base64 string.
 * @param {ArrayBuffer | Uint8Array} buf - The buffer to encode.
 * @returns {string}
 */
export function encodeBuffer(buf) {
  // Buffer.from() handles ArrayBuffer and Uint8Array
  return Buffer.from(buf).toString('base64');
}

/**
 * Decodes a Base64 string into a Node.js Buffer (which is a Uint8Array).
 * @param {string} str - The Base64 string.
 * @returns {Buffer}
 */
export function decodeBuffer(str) {
  return Buffer.from(str, 'base64');
}

/**
 * Generates a buffer of random bytes.
 * @param {number} n - The number of bytes to generate.
 * @returns {Uint8Array}
 */
export function getRandomBytes(n) {
  return webcrypto.getRandomValues(new Uint8Array(n));
}