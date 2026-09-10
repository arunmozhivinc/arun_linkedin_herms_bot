import fs from "node:fs";
import { getStyleProfile } from "../src/content/style-profile.js";
import { fetchAndSavePollinationsImage } from "../src/images/pollinations.js";
import {
  createDraft,
  approveDraft,
  rejectDraft,
  validateForPublishing,
  markPublished,
} from "../src/approval/approval-service.js";
import {
  getDraftById,
  saveDraft,
  deleteDraft,
} from "../src/approval/approval-store.js";

async function runTests() {
  console.log("=== 1. Testing Developer Style Profile ===");
  const profile = getStyleProfile();
  console.log(`Author: ${profile.author} (${profile.role})`);
  console.log(`Skills count: ${profile.core_skills.length}`);
  console.log(`Projects: ${profile.projects.map((p) => p.name).join(", ")}`);
  if (!profile.projects.some((p) => p.name === "Gear Loop")) {
    throw new Error("Gear Loop project missing from style profile!");
  }
  console.log("✓ Style profile verification passed.\n");

  console.log("=== 2. Testing Pollinations.ai Image Generation ===");
  const imageResult = await fetchAndSavePollinationsImage("Next.js Redis cache architecture diagram", {
    draftId: "test-cycle",
  });
  console.log(`Generated image at: ${imageResult.localPath}`);
  console.log(`File size: ${imageResult.sizeBytes} bytes`);
  if (!fs.existsSync(imageResult.localPath) || imageResult.sizeBytes === 0) {
    throw new Error("Image file was not generated properly!");
  }
  console.log("✓ Pollinations.ai generation passed.\n");

  console.log("=== 3. Testing Draft Creation & PENDING_APPROVAL Status ===");
  const sampleText = "How we optimized our Redis caching strategy in Next.js for high-read gear listings at Gear Loop.";
  const draft = createDraft({
    text: sampleText,
    media: {
      type: "image",
      url: imageResult.url,
      path: imageResult.localPath,
      prompt: imageResult.prompt,
    },
    topic: "Next.js / Redis Caching",
    tags: ["#nextjs", "#redis", "#softwareengineering"],
  });

  console.log(`Created Draft ID: ${draft.id}`);
  console.log(`Initial Status:   ${draft.status}`);
  console.log(`Content Hash:     ${draft.contentHash}`);

  if (draft.status !== "PENDING_APPROVAL") {
    throw new Error(`Expected PENDING_APPROVAL but got ${draft.status}`);
  }
  console.log("✓ Draft created in PENDING_APPROVAL status.\n");

  console.log("=== 4. Testing Safety Gate: Block Unapproved Publish ===");
  let blocked = false;
  try {
    validateForPublishing(draft.id);
  } catch (err) {
    blocked = true;
    console.log(`✓ Successfully caught safety block: "${err.message}"`);
  }
  if (!blocked) {
    throw new Error("CRITICAL SAFETY FAILURE: Unapproved draft was allowed to publish!");
  }
  console.log("✓ Safety gate successfully blocked unapproved publishing.\n");

  console.log("=== 5. Testing Draft Approval ===");
  const approvedDraft = approveDraft(draft.id, { approvedBy: "test_suite" });
  console.log(`New Status:  ${approvedDraft.status}`);
  console.log(`Approved At: ${approvedDraft.approvedAt}`);

  if (approvedDraft.status !== "APPROVED") {
    throw new Error(`Expected APPROVED but got ${approvedDraft.status}`);
  }

  // Now validateForPublishing should succeed
  const validated = validateForPublishing(draft.id);
  console.log(`Validated for publishing: ID=${validated.id}, status=${validated.status}`);
  console.log("✓ Draft approval and validation passed.\n");

  console.log("=== 6. Testing Content Tamper Detection ===");
  // Simulate tampering with text in the draft
  const originalText = draft.text;
  approvedDraft.text = "Tampered text that the human never approved!";
  saveDraft(approvedDraft);

  let tamperCaught = false;
  try {
    validateForPublishing(draft.id);
  } catch (err) {
    tamperCaught = true;
    console.log(`✓ Successfully caught tamper attempt: "${err.message}"`);
  }
  if (!tamperCaught) {
    throw new Error("CRITICAL SAFETY FAILURE: Tampered draft bypassed validation!");
  }

  // Restore authentic text
  approvedDraft.text = originalText;
  saveDraft(approvedDraft);
  console.log("✓ Content tampering guard verification passed.\n");

  console.log("=== 7. Testing Publish State & Duplicate Prevention ===");
  markPublished(draft.id, { postId: "urn:li:share:123456789", authorUrn: "urn:li:person:test" });
  const publishedDraft = getDraftById(draft.id);
  console.log(`Published Status: ${publishedDraft.status}`);
  console.log(`Post ID:          ${publishedDraft.postId}`);

  let duplicateBlocked = false;
  try {
    validateForPublishing(draft.id);
  } catch (err) {
    duplicateBlocked = true;
    console.log(`✓ Successfully caught duplicate publish attempt: "${err.message}"`);
  }
  if (!duplicateBlocked) {
    throw new Error("CRITICAL SAFETY FAILURE: Already-published draft was allowed to publish again!");
  }
  console.log("✓ Duplicate publishing guard verification passed.\n");

  console.log("=== 8. Testing Rejection Flow ===");
  const draft2 = createDraft({ text: "Draft to be rejected" });
  const rejected = rejectDraft(draft2.id, { reason: "Need more code examples" });
  console.log(`Rejected draft ID: ${rejected.id}, status: ${rejected.status}, reason: ${rejected.rejectionReason}`);
  let rejectBlocked = false;
  try {
    validateForPublishing(draft2.id);
  } catch (err) {
    rejectBlocked = true;
    console.log(`✓ Successfully blocked publishing for rejected draft: "${err.message}"`);
  }
  if (!rejectBlocked) {
    throw new Error("CRITICAL SAFETY FAILURE: Rejected draft was allowed to publish!");
  }
  console.log("✓ Rejection flow verification passed.\n");

  // Cleanup test files and drafts
  console.log("=== Cleaning up test data ===");
  deleteDraft(draft.id);
  deleteDraft(draft2.id);
  if (fs.existsSync(imageResult.localPath)) {
    fs.unlinkSync(imageResult.localPath);
  }
  console.log("✓ Clean up completed.");

  console.log("\n==========================================");
  console.log("🎉 ALL LIFECYCLE & SAFETY TESTS PASSED!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
