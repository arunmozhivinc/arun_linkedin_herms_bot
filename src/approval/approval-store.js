import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DRAFTS_FILE = path.join(DATA_DIR, "drafts.json");

function ensureStoreExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DRAFTS_FILE)) {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify({ drafts: [] }, null, 2), "utf8");
  }
}

export function getAllDrafts() {
  ensureStoreExists();
  try {
    const raw = fs.readFileSync(DRAFTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.drafts || [];
  } catch (error) {
    console.error("Error reading drafts file:", error.message);
    return [];
  }
}

export function getDraftById(id) {
  const drafts = getAllDrafts();
  return drafts.find((d) => d.id === id) || null;
}

export function saveDraft(draft) {
  ensureStoreExists();
  const drafts = getAllDrafts();
  const existingIndex = drafts.findIndex((d) => d.id === draft.id);

  if (existingIndex >= 0) {
    drafts[existingIndex] = { ...drafts[existingIndex], ...draft, updatedAt: new Date().toISOString() };
  } else {
    drafts.push(draft);
  }

  fs.writeFileSync(DRAFTS_FILE, JSON.stringify({ drafts }, null, 2), "utf8");
  return draft;
}

export function updateDraft(id, updates) {
  ensureStoreExists();
  const drafts = getAllDrafts();
  const index = drafts.findIndex((d) => d.id === id);

  if (index === -1) {
    throw new Error(`Draft with ID "${id}" not found.`);
  }

  drafts[index] = {
    ...drafts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(DRAFTS_FILE, JSON.stringify({ drafts }, null, 2), "utf8");
  return drafts[index];
}

export function deleteDraft(id) {
  ensureStoreExists();
  const drafts = getAllDrafts();
  const filtered = drafts.filter((d) => d.id !== id);
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify({ drafts: filtered }, null, 2), "utf8");
  return true;
}

