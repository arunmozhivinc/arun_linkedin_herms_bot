import crypto from "node:crypto";
import {
  getAllDrafts,
  getDraftById,
  saveDraft,
  updateDraft,
} from "./approval-store.js";

/**
 * Computes a SHA-256 hash of the post content to prevent tampering.
 */
export function computeContentHash(content) {
  const text = (content.text || "").trim();
  const mediaPath = (content.media?.path || content.media?.url || "").trim();
  const payload = `${text}|${mediaPath}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Generates an incremental draft ID in the format GL-YYYYMMDD-XXX
 */
export function generateDraftId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `GL-${yyyy}${mm}${dd}`;

  const drafts = getAllDrafts();
  const todaysDrafts = drafts.filter((d) => d.id.startsWith(datePrefix));

  let maxSeq = 0;
  for (const draft of todaysDrafts) {
    const parts = draft.id.split("-");
    if (parts.length === 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${datePrefix}-${nextSeq}`;
}

/**
 * Creates a draft in PENDING_APPROVAL status.
 */
export function createDraft({ text, media = null, topic = null, tags = [] }) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Post text is required to create a draft.");
  }

  if (text.length > 3000) {
    throw new Error(`Post exceeds LinkedIn 3000 character limit (${text.length} chars).`);
  }

  const id = generateDraftId();
  const now = new Date().toISOString();
  const contentHash = computeContentHash({ text, media });

  const draft = {
    id,
    status: "PENDING_APPROVAL",
    text: text.trim(),
    media: media ? {
      type: media.type || "image",
      url: media.url || null,
      path: media.path || null,
      prompt: media.prompt || null,
      altText: media.altText || "Post visual",
    } : null,
    metadata: {
      topic: topic || "Engineering & Leadership",
      tags: Array.isArray(tags) ? tags : [],
    },
    contentHash,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    approvedBy: null,
    publishedAt: null,
    postId: null,
    authorUrn: null,
  };

  saveDraft(draft);
  return draft;
}

/**
 * Approves a draft, moving status from PENDING_APPROVAL -> APPROVED
 */
export function approveDraft(draftId, { approvedBy = "telegram_user" } = {}) {
  const draft = getDraftById(draftId);
  if (!draft) {
    throw new Error(`Draft "${draftId}" not found.`);
  }

  if (draft.status === "PUBLISHED") {
    throw new Error(`Draft "${draftId}" has already been published to LinkedIn.`);
  }

  if (draft.status === "APPROVED") {
    return draft; // idempotent
  }

  return updateDraft(draftId, {
    status: "APPROVED",
    approvedAt: new Date().toISOString(),
    approvedBy,
  });
}

/**
 * Rejects a draft, moving status to REJECTED
 */
export function rejectDraft(draftId, { reason = "Rejected by user" } = {}) {
  const draft = getDraftById(draftId);
  if (!draft) {
    throw new Error(`Draft "${draftId}" not found.`);
  }

  if (draft.status === "PUBLISHED") {
    throw new Error(`Cannot reject draft "${draftId}" because it is already published.`);
  }

  return updateDraft(draftId, {
    status: "REJECTED",
    rejectionReason: reason,
    rejectedAt: new Date().toISOString(),
  });
}

/**
 * Strict safety gate before publishing.
 * Verifies existence, status === APPROVED, no prior publication, and tamper-proof content hash.
 */
export function validateForPublishing(draftId) {
  const draft = getDraftById(draftId);

  if (!draft) {
    throw new Error(`Draft "${draftId}" not found in storage.`);
  }

  if (draft.status === "PUBLISHED" || draft.publishedAt) {
    throw new Error(
      `Safety violation: Draft "${draftId}" was already published on ${draft.publishedAt} (Post ID: ${draft.postId}). Duplicate publishing is blocked.`
    );
  }

  if (draft.status === "REJECTED") {
    throw new Error(
      `Safety violation: Draft "${draftId}" was explicitly rejected (${draft.rejectionReason || "no reason specified"}). Publishing is blocked.`
    );
  }

  if (draft.status !== "APPROVED") {
    throw new Error(
      `Safety violation: Draft "${draftId}" is currently "${draft.status}". It must be explicitly approved by human review before it can be published.`
    );
  }

  // Integrity / Tamper check
  const currentHash = computeContentHash({ text: draft.text, media: draft.media });
  if (currentHash !== draft.contentHash) {
    throw new Error(
      `Tamper detected: Draft "${draftId}" content hash does not match original approved hash. Publishing aborted.`
    );
  }

  return draft;
}

/**
 * Records that a draft was successfully published.
 */
export function markPublished(draftId, { postId, authorUrn }) {
  return updateDraft(draftId, {
    status: "PUBLISHED",
    publishedAt: new Date().toISOString(),
    postId,
    authorUrn,
  });
}

