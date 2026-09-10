import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf, Markup } from "telegraf";
import { INotificationChannel, DraftPreviewPayload } from "../channel.interface";
import { UsersService } from "../../users/users.service";
import { DraftsService } from "../../drafts/drafts.service";
import { ContentService } from "../../content/content.service";
import { ImageService } from "../../image/image.service";
import { LinkedInPublisherService } from "../../linkedin/linkedin-publisher.service";

@Injectable()
export class TelegramService implements INotificationChannel, OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  readonly channelName = "telegram";
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly draftsService: DraftsService,
    private readonly contentService: ContentService,
    private readonly imageService: ImageService,
    private readonly publisher: LinkedInPublisherService
  ) {}

  onModuleInit() {
    const token = this.config.get<string>("telegram.botToken");
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not configured. Telegram bot listener disabled.");
      return;
    }

    try {
      this.bot = new Telegraf(token);

      // Global error handler to catch API issues without crashing
      this.bot.catch((err: any, ctx) => {
        this.logger.error(`Telegram Bot Error for update ${ctx.update.update_id}: ${err.message}`);
      });

      this.setupHandlers();

      this.bot.launch().catch((err) => {
        this.logger.error(`Failed to launch Telegram bot: ${err.message}`);
      });

      this.logger.log("Telegram Bot successfully launched and listening!");
    } catch (err: any) {
      this.logger.error(`Error initializing Telegram bot: ${err.message}`);
    }
  }

  /**
   * Telegram strictly forbids localhost or 127.0.0.1 inside inline keyboard buttons.
   * Public HTTPS or standard web domains are allowed.
   */
  private isValidTelegramButtonUrl(url?: string): boolean {
    if (!url) return false;
    if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    // /start command - Zero-setup onboarding
    this.bot.start(async (ctx) => {
      try {
        const chatId = String(ctx.chat.id);
        const name = ctx.from?.first_name || "Professional";
        const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";

        await this.usersService.findOrCreateUser(chatId, name);

        const authUrl = `${baseUrl}/auth/linkedin?userId=${chatId}`;

        if (this.isValidTelegramButtonUrl(authUrl)) {
          await ctx.reply(
            `👋 Welcome to **Hermes LinkedIn AutoPilot**, ${name}!\n\n` +
              `You can now message me **any topic** (e.g. *"Write a post about Redis caching"* or *"How we design microservices"*), and I will generate the post, render the image, and queue it for your approval!\n\n` +
              `**Step 1:** Connect your LinkedIn profile:\n\n` +
              `👉 **[Click Here to Connect LinkedIn](${authUrl})**\n\n` +
              `💡 *Tip: If the in-app browser shows a blank page, tap the (⋮) menu at the top right and select "Open in Chrome" or "Open in Safari".*`,
            {
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                [Markup.button.url("🔗 Connect LinkedIn Profile", authUrl)],
              ]),
            }
          );
        } else {
          await ctx.reply(
            `👋 Welcome to **Hermes LinkedIn AutoPilot**, ${name}!\n\n` +
              `You can now message me **any topic** (e.g. *"Write a post about Redis caching"*), and I will generate the post, render the image, and queue it for your approval!\n\n` +
              `**Step 1:** Click the link below to connect your LinkedIn profile:\n\n` +
              `👉 **[Connect LinkedIn Profile](${authUrl})**\n\n` +
              `*(Or copy-paste into your browser:*\n\`${authUrl}\`*)*`,
            {
              parse_mode: "Markdown",
            }
          );
        }
      } catch (err: any) {
        this.logger.error(`Error in /start handler: ${err.message}`);
        await ctx.reply(`Welcome! An error occurred during setup: ${err.message}`);
      }
    });

    // Callback queries from Inline Buttons (Approve / Reject)
    this.bot.action(/^approve_(.+)$/, async (ctx) => {
      const draftId = ctx.match[1];
      try {
        await this.draftsService.approveDraft(draftId, `telegram_${ctx.from.id}`);
        await ctx.answerCbQuery("✅ Post Approved! Publishing...");

        await ctx.reply(`✅ Draft **${draftId}** approved! Publishing to LinkedIn now...`, {
          parse_mode: "Markdown",
        });

        // Publish to LinkedIn directly
        const pub = await this.publisher.publishApprovedDraft(draftId);
        await ctx.reply(
          `🚀 **Successfully Published to LinkedIn!**\n\n` +
            `Post ID: \`${pub.postId}\`\n\n` +
            `Your post is now live on your LinkedIn feed! 🎉`,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        this.logger.error(`Approve handler error: ${err.message}`);
        await ctx.answerCbQuery(`Error: ${err.message}`);
        await ctx.reply(`⚠️ Approval/Publish error: ${err.message}`);
      }
    });

    this.bot.action(/^reject_(.+)$/, async (ctx) => {
      const draftId = ctx.match[1];
      try {
        await this.draftsService.rejectDraft(draftId, "Rejected via Telegram button");
        await ctx.answerCbQuery("❌ Draft Skipped");
        await ctx.reply(`❌ Draft **${draftId}** was skipped.`, { parse_mode: "Markdown" });
      } catch (err: any) {
        this.logger.error(`Reject handler error: ${err.message}`);
        await ctx.answerCbQuery(`Error: ${err.message}`);
        await ctx.reply(`⚠️ Skip error: ${err.message}`);
      }
    });

    // Text commands like "APPROVE GL-..."
    this.bot.hears(/^APPROVE\s+([A-Z0-9-]+)$/i, async (ctx) => {
      const draftId = ctx.match[1].trim();
      try {
        await this.draftsService.approveDraft(draftId, `telegram_${ctx.from.id}`);
        const pub = await this.publisher.publishApprovedDraft(draftId);
        await ctx.reply(`🚀 Published **${draftId}** to LinkedIn! Post ID: \`${pub.postId}\``, {
          parse_mode: "Markdown",
        });
      } catch (err: any) {
        await ctx.reply(`Approval/Publish failed: ${err.message}`);
      }
    });

    // ANY text message -> DIRECT PROMPT FOR NEW DRAFT!
    this.bot.on("text", async (ctx) => {
      const text = ctx.message.text.trim();
      const chatId = String(ctx.chat.id);

      // Skip commands like /start or APPROVE
      if (text.startsWith("/") || text.startsWith("APPROVE")) return;

      const user = await this.usersService.getUser(chatId);
      if (!user || !user.linkedIn?.accessToken) {
        const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";
        const authUrl = `${baseUrl}/auth/linkedin?userId=${chatId}`;
        await ctx.reply(
          `⚠️ You need to connect your LinkedIn profile first before generating posts!\n\n` +
            `👉 [Click Here to Connect LinkedIn](${authUrl})`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      await ctx.reply(`⏳ Crafting your LinkedIn post & generating visual for:\n*"${text}"*...`, {
        parse_mode: "Markdown",
      });

      try {
        // 1. Generate text and image prompt
        const content = await this.contentService.generatePost(text, chatId);

        // 2. Generate Pollinations visual
        const imgResult = await this.imageService.generateImage(content.imagePrompt, {
          userPhotoUrl: user.professionalPhotoPath,
          preferFaceReference: Boolean(user.professionalPhotoPath),
        });

        // 3. Create Draft in MongoDB
        const draft = await this.draftsService.createDraft({
          userId: chatId,
          text: content.text,
          topic: content.topic,
          tags: content.tags,
          media: {
            type: "image",
            url: imgResult.url,
            localPath: imgResult.localPath,
            prompt: imgResult.prompt,
          },
        });

        // 4. Send preview with interactive Approve & Skip buttons
        const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";
        await this.sendDraftPreview(chatId, {
          draftId: draft.draftId,
          postType: "SHORT_POST",
          text: draft.text,
          topic: draft.metadata?.topic,
          previewUrl: `${baseUrl}/drafts/${draft.draftId}`,
          approvalUrl: `${baseUrl}/drafts/${draft.draftId}/approve`,
          imageUrl: imgResult.url,
          prompt: imgResult.prompt,
        });
      } catch (err: any) {
        this.logger.error(`Error generating post from Telegram prompt: ${err.message}`);
        await ctx.reply(`❌ Failed to generate draft: ${err.message}`);
      }
    });
  }

  async sendDraftPreview(channelUserId: string, payload: DraftPreviewPayload): Promise<void> {
    if (!this.bot) {
      this.logger.warn(`Telegram not configured; draft preview ${payload.draftId} skipped.`);
      return;
    }

    const isButtonUrlValid = this.isValidTelegramButtonUrl(payload.previewUrl);

    let caption =
      `📝 **LinkedIn Draft Ready for Review**\n` +
      `**Draft ID:** \`${payload.draftId}\`\n` +
      `**Topic:** ${payload.topic || "General"}\n\n` +
      `${payload.text.length > 750 ? payload.text.slice(0, 750) + "..." : payload.text}\n\n` +
      `Review and authorize publication below:`;

    if (!isButtonUrlValid && payload.previewUrl) {
      caption += `\n\n📱 [Open Full Web Preview](${payload.previewUrl})`;
    }

    const keyboardRows: any[] = [
      [
        Markup.button.callback("✅ Approve", `approve_${payload.draftId}`),
        Markup.button.callback("❌ Skip", `reject_${payload.draftId}`),
      ],
    ];

    if (isButtonUrlValid) {
      keyboardRows.push([Markup.button.url("📱 Full Web Preview", payload.previewUrl)]);
    }

    const buttons = Markup.inlineKeyboard(keyboardRows);

    try {
      if (payload.imageUrl) {
        await this.bot.telegram.sendPhoto(channelUserId, payload.imageUrl, {
          caption,
          parse_mode: "Markdown",
          ...buttons,
        });
      } else {
        await this.bot.telegram.sendMessage(channelUserId, caption, {
          parse_mode: "Markdown",
          ...buttons,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram draft preview to ${channelUserId}: ${err.message}`);
    }
  }

  async sendPublishSuccess(channelUserId: string, draftId: string, postId: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(
        channelUserId,
        `🚀 **Published to LinkedIn!**\n` +
          `Draft: \`${draftId}\`\n` +
          `Post ID: \`${postId}\`\n\n` +
          `Your post is now live on your LinkedIn feed! 🎉`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram publish notification: ${err.message}`);
    }
  }

  async sendDirectMessage(channelUserId: string, message: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(channelUserId, message, { parse_mode: "Markdown" });
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram message to ${channelUserId}: ${err.message}`);
    }
  }
}
