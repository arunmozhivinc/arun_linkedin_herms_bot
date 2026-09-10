import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { loadToken, getAccessToken } from "./oauth/token-store.js";
import { getLinkedInProfile } from "./linkedin/profile.js";
import { uploadImageToLinkedIn } from "./linkedin/media.js";
import { publishLinkedInPost } from "./linkedin/posts.js";
import { getStyleProfile } from "./content/style-profile.js";
import { fetchAndSavePollinationsImage, getPollinationsUrl } from "./images/pollinations.js";
import {
  createDraft,
  approveDraft,
  rejectDraft,
  validateForPublishing,
  markPublished,
} from "./approval/approval-service.js";
import {
  getAllDrafts,
  getDraftById,
} from "./approval/approval-store.js";
import fs from "node:fs";
import path from "node:path";

async function sendTelegramDraftNotification(draft) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  let chatId = process.env.TELEGRAM_USER_ID;
  if (!chatId) {
    try {
      const usersFile = path.resolve(process.cwd(), "data/users.json");
      if (fs.existsSync(usersFile)) {
        const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
        chatId = users[0]?.telegramUserId;
      }
    } catch {}
  }
  if (!chatId) return;

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const previewUrl = `${baseUrl}/drafts/${draft.id}`;
  const isButtonUrlValid = baseUrl.startsWith("https://") || (baseUrl.startsWith("http://") && !baseUrl.includes("localhost"));

  const caption =
    `📝 *LinkedIn Draft Ready for Review*\n\n` +
    `*Draft ID:* \`${draft.id}\`\n` +
    `*Topic:* ${draft.metadata?.topic || "General"}\n\n` +
    `${draft.text.length > 700 ? draft.text.slice(0, 700) + "..." : draft.text}\n\n` +
    `Review and authorize publication below:`;

  const keyboardRows = [
    [
      { text: "✅ Approve", callback_data: `approve_${draft.id}` },
      { text: "❌ Skip", callback_data: `reject_${draft.id}` },
    ],
  ];

  if (isButtonUrlValid) {
    keyboardRows.push([{ text: "📱 Full Web Preview", url: previewUrl }]);
  }

  const endpoint = draft.media?.url
    ? `https://api.telegram.org/bot${token}/sendPhoto`
    : `https://api.telegram.org/bot${token}/sendMessage`;

  const body = draft.media?.url
    ? {
        chat_id: chatId,
        photo: draft.media.url,
        caption,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboardRows },
      }
    : {
        chat_id: chatId,
        text: caption,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboardRows },
      };

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Failed to send Telegram notification:", err.message);
  }
}

async function sendTelegramPublishNotification(draft, postId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  let chatId = process.env.TELEGRAM_USER_ID;
  if (!chatId) {
    try {
      const usersFile = path.resolve(process.cwd(), "data/users.json");
      if (fs.existsSync(usersFile)) {
        const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
        chatId = users[0]?.telegramUserId;
      }
    } catch {}
  }
  if (!chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚀 *Published to LinkedIn!*\n\nDraft: \`${draft.id}\`\nPost ID: \`${postId}\`\n\nYour post is live on your LinkedIn feed! 🎉`,
        parse_mode: "Markdown",
      }),
    });
  } catch {}
}

serveStdio(() => {
  const server = new McpServer({
    name: "linkedin-hermes",
    version: "2.0.0",
  });

  // --------------------------------------------------
  // 1. Get Developer Persona & Style Profile
  // --------------------------------------------------
  server.registerTool(
    "linkedin_get_style_profile",
    {
      description:
        "Retrieve Arun's real skills, production projects (Gear Loop), and post structuring rules. Hermes should use this before generating any LinkedIn draft to ensure technical authenticity and zero AI buzzwords.",
      inputSchema: z.object({}),
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(getStyleProfile(), null, 2),
          },
        ],
      };
    }
  );

  // --------------------------------------------------
  // 2. Get Authenticated LinkedIn Profile
  // --------------------------------------------------
  server.registerTool(
    "linkedin_get_profile",
    {
      description: "Get the currently authenticated LinkedIn member profile.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const token = getAccessToken();
        const profile = await getLinkedInProfile(token);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, profile }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 3. Create Draft (With Optional Pollinations Image)
  // --------------------------------------------------
  server.registerTool(
    "linkedin_create_draft",
    {
      description:
        "Creates a new LinkedIn post draft in PENDING_APPROVAL status. Hermes can supply text and an imagePrompt. If imagePrompt is provided, Pollinations.ai generates and caches the visual. The post is NEVER published immediately.",
      inputSchema: z.object({
        text: z
          .string()
          .min(1)
          .max(3000)
          .describe("The exact text of the LinkedIn post."),
        imagePrompt: z
          .string()
          .optional()
          .describe("Optional visual idea for Pollinations.ai (e.g., 'Redis cluster cache architecture visual, clean tech desk')."),
        topic: z
          .string()
          .optional()
          .describe("Topic or category for organization (e.g., 'Redis / Next.js Architecture')."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Relevant hashtags (e.g., ['#nextjs', '#systemdesign'])."),
      }),
    },
    async ({ text, imagePrompt, topic, tags = [] }) => {
      try {
        let media = null;

        if (imagePrompt && imagePrompt.trim().length > 0) {
          // Generate preliminary image via Pollinations.ai
          try {
            const imageResult = await fetchAndSavePollinationsImage(imagePrompt);
            media = {
              type: "image",
              url: imageResult.url,
              path: imageResult.localPath,
              prompt: imageResult.prompt,
              altText: topic || "Post visual",
            };
          } catch (imgErr) {
            console.error("Pollinations image generation error:", imgErr.message);
            // Fallback to direct URL if file write failed
            media = {
              type: "image",
              url: getPollinationsUrl(imagePrompt),
              prompt: imagePrompt,
              altText: topic || "Post visual",
            };
          }
        const draft = createDraft({ text, media, topic, tags });

        // Send instant notification with photo and approve button to Telegram
        await sendTelegramDraftNotification(draft);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  draftId: draft.id,
                  status: draft.status,
                  previewUrl: `http://localhost:3000/drafts/${draft.id}`,
                  approvalUrl: `http://localhost:3000/drafts/${draft.id}/approve`,
                  text: draft.text,
                  media: draft.media,
                  metadata: draft.metadata,
                  instructions:
                    "Draft created and queued for human approval. Present the draft text and image preview to the user. Do NOT call linkedin_publish_post until the user explicitly approves.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 4. List Drafts
  // --------------------------------------------------
  server.registerTool(
    "linkedin_list_drafts",
    {
      description: "List drafts with optional status filter (PENDING_APPROVAL, APPROVED, PUBLISHED, REJECTED).",
      inputSchema: z.object({
        status: z
          .enum(["PENDING_APPROVAL", "APPROVED", "PUBLISHED", "REJECTED", "ALL"])
          .optional()
          .describe("Filter drafts by status. Defaults to ALL."),
      }),
    },
    async ({ status = "ALL" }) => {
      try {
        const drafts = getAllDrafts();
        const filtered = status === "ALL" ? drafts : drafts.filter((d) => d.status === status);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: filtered.length, drafts: filtered }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 5. Get Draft Details
  // --------------------------------------------------
  server.registerTool(
    "linkedin_get_draft",
    {
      description: "Retrieve complete details of a specific draft by draft ID.",
      inputSchema: z.object({
        draftId: z.string().describe("The draft ID (e.g. GL-20260910-001)."),
      }),
    },
    async ({ draftId }) => {
      try {
        const draft = getDraftById(draftId);
        if (!draft) {
          return {
            isError: true,
            content: [{ type: "text", text: `Draft "${draftId}" not found.` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 6. Approve Draft
  // --------------------------------------------------
  server.registerTool(
    "linkedin_approve_draft",
    {
      description: "Explicitly approve a draft post. Hermes calls this only after the human user in Telegram states 'APPROVE <draftId>'.",
      inputSchema: z.object({
        draftId: z.string().describe("The draft ID to approve."),
      }),
    },
    async ({ draftId }) => {
      try {
        const approvedDraft = approveDraft(draftId, { approvedBy: "telegram_user" });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  draftId: approvedDraft.id,
                  status: approvedDraft.status,
                  approvedAt: approvedDraft.approvedAt,
                  message: `Draft ${draftId} successfully approved. It is now authorized for publishing via linkedin_publish_post.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 7. Reject Draft
  // --------------------------------------------------
  server.registerTool(
    "linkedin_reject_draft",
    {
      description: "Marks a draft as REJECTED when the user rejects it or requests changes.",
      inputSchema: z.object({
        draftId: z.string().describe("The draft ID to reject."),
        reason: z.string().optional().describe("Optional reason for rejection or feedback."),
      }),
    },
    async ({ draftId, reason = "Rejected by user" }) => {
      try {
        const rejected = rejectDraft(draftId, { reason });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  draftId: rejected.id,
                  status: rejected.status,
                  rejectionReason: rejected.rejectionReason,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  // --------------------------------------------------
  // 8. Publish Post (Strictly Enforced Approval Gate)
  // --------------------------------------------------
  server.registerTool(
    "linkedin_publish_post",
    {
      description:
        "Publishes an APPROVED draft to LinkedIn. Throws a hard safety error if the draft has not been approved by human review, if content has been tampered with, or if it was already published.",
      inputSchema: z.object({
        draftId: z.string().describe("The ID of the draft to publish (must be in APPROVED status)."),
      }),
    },
    async ({ draftId }) => {
      try {
        // Strict safety boundary check
        const draft = validateForPublishing(draftId);

        // Load valid OAuth token
        const token = getAccessToken();

        // Get authenticated member URN
        const profile = await getLinkedInProfile(token);
        if (!profile.sub) {
          throw new Error("LinkedIn profile did not contain a member identifier (sub).");
        }
        const authorUrn = `urn:li:person:${profile.sub}`;

        let mediaImageUrn = null;

        // If draft has an attached image, upload it to LinkedIn REST API
        if (draft.media?.path) {
          try {
            const mediaUpload = await uploadImageToLinkedIn({
              accessToken: token,
              authorUrn,
              imagePath: draft.media.path,
            });
            mediaImageUrn = mediaUpload.imageUrn;
          } catch (uploadErr) {
            console.error("LinkedIn media upload error:", uploadErr.message);
            throw new Error(`Failed to upload attached image to LinkedIn: ${uploadErr.message}`);
          }
        }

        // Publish to LinkedIn REST /rest/posts
        const publishResult = await publishLinkedInPost({
          accessToken: token,
          authorUrn,
          commentary: draft.text,
          mediaImageUrn,
          mediaTitle: draft.metadata?.topic || "Post visual",
        });

        // Record in store as PUBLISHED
        const publishedDraft = markPublished(draftId, {
          postId: publishResult.postId,
          authorUrn,
        });

        // Send publish confirmation to Telegram
        await sendTelegramPublishNotification(publishedDraft, publishedDraft.postId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Draft published successfully to LinkedIn.",
                  draftId: publishedDraft.id,
                  status: publishedDraft.status,
                  postId: publishedDraft.postId,
                  publishedAt: publishedDraft.publishedAt,
                  authorUrn,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }],
        };
      }
    }
  );

  return server;
});