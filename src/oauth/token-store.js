import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TOKEN_FILE = path.join(os.homedir(), ".linkedin-hermes-token.json");

/**
 * Saves LinkedIn OAuth token to user home directory.
 * Adds savedAt timestamp to calculate expiration.
 */
export function saveToken(tokenData) {
  const payload = {
    ...tokenData,
    saved_at: Date.now(),
  };

  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify(payload, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
}

/**
 * Loads token from storage if available.
 */
export function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to parse token file:", error.message);
    return null;
  }
}

/**
 * Checks if token exists and is not expired.
 */
export function isTokenValid() {
  const token = loadToken();
  if (!token || !token.access_token) {
    return false;
  }

  if (token.expires_in && token.saved_at) {
    const expiresAt = token.saved_at + (token.expires_in * 1000);
    // Buffer by 60 seconds
    return Date.now() < (expiresAt - 60000);
  }

  return true;
}

/**
 * Gets access token string or throws descriptive error.
 */
export function getAccessToken() {
  const token = loadToken();
  if (!token?.access_token) {
    throw new Error("LinkedIn is not authenticated. Please run the OAuth server and visit http://localhost:3000/auth/linkedin to authorize.");
  }
  return token.access_token;
}

