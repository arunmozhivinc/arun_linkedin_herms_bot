import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { UsersService } from "../users/users.service";
import { DraftsService } from "../drafts/drafts.service";
import { ImageService } from "../image/image.service";
import { DailyPosterService } from "../cron/daily-poster.service";
import { TelegramService } from "../channels/telegram/telegram.service";
import { ConfigService } from "@nestjs/config";

export async function bootstrapMcp() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const usersService = app.get(UsersService);
  const draftsService = app.get(DraftsService);
  const imageService = app.get(ImageService);
  const dailyPoster = app.get(DailyPosterService);
  const telegramService = app.get(TelegramService);
  const config = app.get(ConfigService);
  const baseUrl = config.get<string>("baseUrl");

  serveStdio(() => {
    const server = new McpServer({
      name: "linkedin-hermes-enterprise",
      version: "2.0.0",
    });

    // 1. Get Style Profile (Dynamic Per User)
    server.registerTool(
      "linkedin_get_style_profile",
      {
        description: "Retrieve developer skills, active projects, and post structuring rules dynamically.",
        inputSchema: z.object({
          userId: z.string().optional().describe("Optional Telegram user ID. Defaults to primary active user."),
        }),
      },
      async ({ userId }) => {
        const profile = await usersService.buildStyleProfile(userId);
        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        };
      }
    );

    // 2. Create Draft with Image & Telegram Notification
    server.registerTool(
      "linkedin_create_draft",
      {
        description:
          "Creates a new draft in PENDING_APPROVAL status. Generates matching visual via Pollinations/Fal.ai and automatically queues for approval in Telegram.",
        inputSchema: z.object({
          userId: z.string().optional().describe("The user ID. Defaults to the active onboarded user."),
          text: z.string().min(1).max(3000).describe("The exact LinkedIn post text."),
          imagePrompt: z.string().optional().describe("Visual prompt for the image engine."),
          topic: z.string().optional().describe("Topic or domain."),
          tags: z.array(z.string()).optional().describe("Relevant hashtags."),
        }),
      },
      async ({ userId, text, imagePrompt, topic, tags = [] }) => {
        try {
          let targetUserId = userId;
          if (!targetUserId) {
            const active = await usersService.getAllActiveUsers();
            targetUserId = active[0]?.telegramUserId || "default";
          }

          let media: any = null;
          if (imagePrompt && imagePrompt.trim().length > 0) {
            const user = await usersService.getUser(targetUserId);
            const imageResult = await imageService.generateImage(imagePrompt, {
              userPhotoUrl: user?.professionalPhotoPath,
              preferFaceReference: Boolean(user?.professionalPhotoPath),
            });
            if (imageResult) {
              media = {
                type: "image",
                url: imageResult.url,
                localPath: imageResult.localPath,
                prompt: imageResult.prompt,
              };
            }
          }

          const draft = await draftsService.createDraft({
            userId: targetUserId,
            text,
            media,
            topic: topic || "General",
            tags,
          });

          // Notify user in Telegram
          await telegramService.sendDraftPreview(targetUserId, {
            draftId: draft.draftId,
            postType: "SHORT_POST",
            text: draft.text,
            topic: draft.metadata?.topic,
            previewUrl: `${baseUrl}/drafts/${draft.draftId}`,
            approvalUrl: `${baseUrl}/drafts/${draft.draftId}/approve`,
            imageUrl: media?.url,
            prompt: media?.prompt,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    draftId: draft.draftId,
                    status: draft.status,
                    previewUrl: `${baseUrl}/drafts/${draft.draftId}`,
                    approvalUrl: `${baseUrl}/drafts/${draft.draftId}/approve`,
                    message: "Draft created and sent to user's Telegram. Do NOT publish until user explicitly approves.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err: any) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
      }
    );

    // 3. List Drafts
    server.registerTool(
      "linkedin_list_drafts",
      {
        description: "List drafts filtered by status.",
        inputSchema: z.object({
          userId: z.string().optional(),
          status: z.enum(["PENDING_APPROVAL", "APPROVED", "PUBLISHED", "REJECTED", "ALL"]).optional(),
        }),
      },
      async ({ userId, status = "ALL" }) => {
        const drafts = await draftsService.listDrafts({ userId, status });
        return {
          content: [{ type: "text", text: JSON.stringify({ count: drafts.length, drafts }, null, 2) }],
        };
      }
    );

    // 4. Get Draft Details
    server.registerTool(
      "linkedin_get_draft",
      {
        description: "Retrieve full details of a draft.",
        inputSchema: z.object({ draftId: z.string() }),
      },
      async ({ draftId }) => {
        const draft = await draftsService.getDraft(draftId);
        if (!draft) return { isError: true, content: [{ type: "text", text: `Draft ${draftId} not found.` }] };
        return { content: [{ type: "text", text: JSON.stringify(draft, null, 2) }] };
      }
    );

    // 5. Approve Draft
    server.registerTool(
      "linkedin_approve_draft",
      {
        description: "Marks a draft as APPROVED after human confirmation in Telegram.",
        inputSchema: z.object({ draftId: z.string() }),
      },
      async ({ draftId }) => {
        try {
          const approved = await draftsService.approveDraft(draftId, "hermes_approval");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, draftId: approved.draftId, status: approved.status }, null, 2),
              },
            ],
          };
        } catch (err: any) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
      }
    );

    // 6. Reject Draft
    server.registerTool(
      "linkedin_reject_draft",
      {
        description: "Marks draft as REJECTED.",
        inputSchema: z.object({ draftId: z.string(), reason: z.string().optional() }),
      },
      async ({ draftId, reason = "Rejected by user" }) => {
        try {
          const rejected = await draftsService.rejectDraft(draftId, reason);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, draftId: rejected.draftId, status: rejected.status }, null, 2),
              },
            ],
          };
        } catch (err: any) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
      }
    );

    // 7. Publish Post (Strictly Guarded)
    server.registerTool(
      "linkedin_publish_post",
      {
        description: "Publishes an APPROVED draft to LinkedIn. Aborts if draft is unapproved or tampered with.",
        inputSchema: z.object({ draftId: z.string() }),
      },
      async ({ draftId }) => {
        try {
          const result = await dailyPoster.publishApprovedDraft(draftId);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    draftId,
                    postId: result.postId,
                    message: "Post successfully published to LinkedIn.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err: any) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
      }
    );

    // 8. Get Member Profile
    server.registerTool(
      "linkedin_get_profile",
      {
        description: "Get authenticated LinkedIn member details.",
        inputSchema: z.object({ userId: z.string().optional() }),
      },
      async ({ userId }) => {
        try {
          const user = userId ? await usersService.getUser(userId) : (await usersService.getAllActiveUsers())[0];
          if (!user?.linkedIn?.accessToken) {
            return { isError: true, content: [{ type: "text", text: "User has not connected LinkedIn." }] };
          }
          return {
            content: [{ type: "text", text: JSON.stringify(user.linkedIn, null, 2) }],
          };
        } catch (err: any) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
      }
    );

    return server;
  });
}

// If invoked directly from CLI
if (process.argv[1] && process.argv[1].includes("mcp.server")) {
  bootstrapMcp().catch((err) => {
    console.error("Failed to start MCP Server:", err);
    process.exit(1);
  });
}

