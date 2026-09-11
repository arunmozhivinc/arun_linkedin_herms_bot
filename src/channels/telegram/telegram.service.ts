import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf, Markup } from "telegraf";
import { INotificationChannel, DraftPreviewPayload } from "../channel.interface";
import { UsersService } from "../../users/users.service";
import { DraftsService } from "../../drafts/drafts.service";
import { ContentService } from "../../content/content.service";
import { ImageService } from "../../image/image.service";
import { LinkedInPublisherService } from "../../linkedin/linkedin-publisher.service";

import * as fs from "node:fs";
import * as path from "node:path";

const AVAILABLE_POSITIONS = [
  "Backend Developer",
  "Frontend Developer",
  "Full-Stack Engineer",
  "DevOps / Cloud Engineer",
  "AI / ML Engineer",
  "System Architect",
  "UI / UX Designer",
  "Product Manager",
  "Research & Data Scientist",
  "Marketing & Growth",
  "Founder & Entrepreneur",
];

const AVAILABLE_SKILLS = [
  "Node.js / TypeScript",
  "Python / FastAPI",
  "Docker & Kubernetes",
  "AWS / Cloud Infra",
  "MongoDB & PostgreSQL",
  "React & Next.js",
  "System Design & Scale",
  "LLMs & AI Agents",
  "UI/UX & Design Systems",
  "User Research & Testing",
  "Product Strategy & Roadmaps",
  "Data Analytics & Metrics",
  "SEO & Content Growth",
  "No-Code & Automations",
];

@Injectable()
export class TelegramService implements INotificationChannel, OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  readonly channelName = "telegram";
  private bot: Telegraf | null = null;
  private readonly awaitingImageForDraft = new Map<string, string>(); // chatId -> draftId

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly draftsService: DraftsService,
    private readonly contentService: ContentService,
    private readonly imageService: ImageService,
    private readonly publisher: LinkedInPublisherService
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>("telegram.botToken");
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not configured. Telegram bot listener disabled.");
      return;
    }

    try {
      this.bot = new Telegraf(token);

      this.bot.catch((err: any, ctx) => {
        this.logger.error(`Telegram Bot Error for update ${ctx.update.update_id}: ${err.message}`);
      });

      this.setupHandlers();

      const rawBaseUrl = this.config.get<string>("baseUrl");
      const baseUrl = (rawBaseUrl || "").replace(/\/+$/, "");

      if (
        baseUrl &&
        baseUrl.startsWith("https://") &&
        !baseUrl.includes("localhost") &&
        !baseUrl.includes("127.0.0.1")
      ) {
        // Production Cloud Mode (Render): Use Webhooks. 100% eliminates 409 getUpdates conflict!
        const webhookUrl = `${baseUrl}/telegram/webhook`;
        this.logger.log(`Registering Telegram Webhook at: ${webhookUrl}`);
        await this.bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: false });
        this.logger.log("✅ Telegram Webhook successfully active and listening!");
      } else {
        // Local Development Mode: Use long polling with clean webhook deletion
        this.logger.log("Local mode detected. Clearing webhooks and starting polling...");
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: false });
        this.launchBotWithRetry();
      }
    } catch (err: any) {
      this.logger.error(`Error initializing Telegram bot: ${err.message}`);
    }
  }

  async handleUpdate(update: any) {
    if (this.bot) {
      await this.bot.handleUpdate(update);
    }
  }

  private launchBotWithRetry(retries = 10, delayMs = 5000) {
    if (!this.bot) return;
    this.bot
      .launch()
      .then(() => {
        this.logger.log("Telegram Bot successfully launched and listening!");
      })
      .catch(async (err: any) => {
        this.logger.error(`Failed to launch Telegram bot: ${err.message}`);
        if (retries > 0) {
          this.logger.log(`Retrying Telegram bot launch in ${delayMs / 1000}s... (${retries} retries left)`);
          await new Promise((res) => setTimeout(res, delayMs));
          this.launchBotWithRetry(retries - 1, delayMs);
        }
      });
  }

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

  private buildPositionsKeyboard(selected: string[] = []) {
    const rows = AVAILABLE_POSITIONS.map((pos, idx) => {
      const isChecked = selected.includes(pos);
      return [Markup.button.callback(`${isChecked ? "✅" : "⬜"} ${pos}`, `pos_toggle_${idx}`)];
    });
    rows.push([Markup.button.callback("➡️ Save & Continue to Skills (Q3)", "pos_done")]);
    return Markup.inlineKeyboard(rows);
  }

  private buildSkillsKeyboard(selected: string[] = []) {
    const rows = AVAILABLE_SKILLS.map((skill, idx) => {
      const isChecked = selected.includes(skill);
      return [Markup.button.callback(`${isChecked ? "✅" : "⬜"} ${skill}`, `skill_toggle_${idx}`)];
    });
    rows.push([Markup.button.callback("➡️ Save & Continue to Background (Q4)", "skill_done")]);
    return Markup.inlineKeyboard(rows);
  }

  private setupHandlers() {
    if (!this.bot) return;

    // ----------------------------------------------------
    // /start - Launch 5-Question Onboarding Wizard
    // ----------------------------------------------------
    this.bot.start(async (ctx) => {
      try {
        const chatId = String(ctx.chat.id);
        const name = ctx.from?.first_name || "Professional";

        await this.usersService.findOrCreateUser(chatId, name);
        await this.usersService.updateUser(chatId, { onboardingStep: "NAME" });

        await ctx.reply(
          `👋 Welcome to **LinkedIn AutoPilot**, ${name}!\n\n` +
            `I create high-performing, authentic LinkedIn posts with AI visuals on schedule.\n\n` +
            `Let's personalize your setup in **5 quick questions**:\n\n` +
            `**Question 1 of 5: What is your full name?**\n` +
            `Type your full name below, or tap Keep below:`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback(`Keep "${name}"`, "name_keep")],
            ]),
          }
        );
      } catch (err: any) {
        this.logger.error(`Error in /start: ${err.message}`);
        await ctx.reply(`Welcome! An error occurred: ${err.message}`);
      }
    });

    // ----------------------------------------------------
    // Q1: Name Handler (Button callback or text)
    // ----------------------------------------------------
    this.bot.action("name_keep", async (ctx) => {
      await ctx.answerCbQuery();
      const chatId = String(ctx.chat.id);
      const user = await this.usersService.getUser(chatId);
      await this.usersService.updateUser(chatId, { onboardingStep: "POSITION" });
      await this.promptPositionQuestion(ctx, user?.positions || []);
    });

    // ----------------------------------------------------
    // Q2: Position Multi-Select Toggles
    // ----------------------------------------------------
    this.bot.action(/^pos_toggle_(\d+)$/, async (ctx) => {
      const idx = parseInt(ctx.match[1], 10);
      const pos = AVAILABLE_POSITIONS[idx];
      const chatId = String(ctx.chat.id);
      if (!pos) return;

      const updated = await this.usersService.toggleUserPosition(chatId, pos);
      await ctx.answerCbQuery(`${updated.includes(pos) ? "Selected" : "Removed"} ${pos}`);
      try {
        await ctx.editMessageReplyMarkup(this.buildPositionsKeyboard(updated).reply_markup);
      } catch {}
    });

    this.bot.action("pos_done", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const user = await this.usersService.getUser(chatId);
      if (!user.positions || user.positions.length === 0) {
        await ctx.answerCbQuery("⚠️ Please select at least 1 position!");
        return;
      }

      await ctx.answerCbQuery("Positions saved!");
      await this.usersService.updateUser(chatId, { onboardingStep: "SKILLS" });
      await this.promptSkillsQuestion(ctx, user.skills || []);
    });

    // ----------------------------------------------------
    // Q3: Skills Multi-Select Toggles
    // ----------------------------------------------------
    this.bot.action(/^skill_toggle_(\d+)$/, async (ctx) => {
      const idx = parseInt(ctx.match[1], 10);
      const skill = AVAILABLE_SKILLS[idx];
      const chatId = String(ctx.chat.id);
      if (!skill) return;

      const updated = await this.usersService.toggleUserSkill(chatId, skill);
      await ctx.answerCbQuery(`${updated.includes(skill) ? "Selected" : "Removed"} ${skill}`);
      try {
        await ctx.editMessageReplyMarkup(this.buildSkillsKeyboard(updated).reply_markup);
      } catch {}
    });

    this.bot.action("skill_done", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const user = await this.usersService.getUser(chatId);
      if (!user.skills || user.skills.length === 0) {
        await ctx.answerCbQuery("⚠️ Please select at least 1 skill!");
        return;
      }

      await ctx.answerCbQuery("Skills saved!");
      await this.usersService.updateUser(chatId, { onboardingStep: "CUSTOM_DATA" });

      await ctx.reply(
        `📝 **Question 4 of 5: Custom Background / Voice Training**\n\n` +
          `Tell me a bit about your experience, past companies, major projects, or preferred tone to train your personal AI.\n\n` +
          `*(Example: "Senior engineer with 6 years building high-throughput payment pipelines. I love pragmatic code and database internals.")*\n\n` +
          `Reply with your text below, or tap Skip:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("⏩ Skip Background", "skip_bio")],
          ]),
        }
      );
    });

    // ----------------------------------------------------
    // Q4: Skip Background
    // ----------------------------------------------------
    this.bot.action("skip_bio", async (ctx) => {
      await ctx.answerCbQuery();
      const chatId = String(ctx.chat.id);
      await this.usersService.updateUser(chatId, { onboardingStep: "SCHEDULE" });
      await this.promptScheduleQuestion(ctx);
    });

    // ----------------------------------------------------
    // Q5: Schedule Selection
    // ----------------------------------------------------
    this.bot.action(/^sched_(.+)$/, async (ctx) => {
      const choice = ctx.match[1];
      const chatId = String(ctx.chat.id);

      let schedule = { frequency: "daily", preferredHour: 19, timezone: "Asia/Kolkata" };
      let scheduleLabel = "Daily at 7:00 PM";

      if (choice === "9") {
        schedule = { frequency: "daily", preferredHour: 9, timezone: "Asia/Kolkata" };
        scheduleLabel = "Daily at 9:00 AM";
      } else if (choice === "13") {
        schedule = { frequency: "daily", preferredHour: 13, timezone: "Asia/Kolkata" };
        scheduleLabel = "Daily at 1:00 PM";
      } else if (choice === "19") {
        schedule = { frequency: "daily", preferredHour: 19, timezone: "Asia/Kolkata" };
        scheduleLabel = "Daily at 7:00 PM";
      } else if (choice === "auto") {
        schedule = { frequency: "daily", preferredHour: 10, timezone: "Asia/Kolkata" };
        scheduleLabel = "Daily whenever ready (10 AM)";
      } else if (choice === "3x") {
        schedule = { frequency: "3x_week", preferredHour: 19, timezone: "Asia/Kolkata" };
        scheduleLabel = "3 Times a Week (Mon / Wed / Fri at 7 PM)";
      } else if (choice === "2min") {
        schedule = { frequency: "test_2min", preferredHour: -1, timezone: "Asia/Kolkata" };
        scheduleLabel = "Every 2 Minutes (🧪 Test Mode)";
      } else if (choice === "pause") {
        await this.usersService.setSchedulingPaused(chatId, true);
        await ctx.answerCbQuery("Automated posting paused");
        await ctx.reply(
          `⏸️ **Automated Postings Paused!**\n\n` +
            `I will not send you automated scheduled drafts.\n` +
            `Type **/resume** at any time to re-enable, or send any topic for an instant post!`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      await this.usersService.updateUser(chatId, {
        postingSchedule: schedule,
        onboardingStep: "COMPLETED",
        isOnboarded: true,
        schedulingPaused: false,
      });

      await ctx.answerCbQuery(`Schedule set to ${scheduleLabel}`);
      await this.showCompletionCard(ctx, chatId, scheduleLabel);
    });

    // ----------------------------------------------------
    // Custom Image Replacement Request
    // ----------------------------------------------------
    this.bot.action(/^custom_img_(.+)$/, async (ctx) => {
      const draftId = ctx.match[1];
      const chatId = String(ctx.chat.id);
      this.awaitingImageForDraft.set(chatId, draftId);
      await ctx.answerCbQuery("Ready for your image!");
      await ctx.reply(
        `📸 **Send your custom image for Draft \`${draftId}\`:**\n\n` +
          `Please send any photo or image attachment directly here in the chat.\n` +
          `I will replace the visual and send you an updated draft preview card right away!`,
        { parse_mode: "Markdown" }
      );
    });

    // ----------------------------------------------------
    // Bot Commands: /pause, /resume, /status, /schedule
    // ----------------------------------------------------
    this.bot.command("pause", async (ctx) => {
      const chatId = String(ctx.chat.id);
      await this.usersService.setSchedulingPaused(chatId, true);
      await ctx.reply(
        `⏸️ **Automated Scheduled Postings Paused**\n\n` +
          `I will not send you scheduled drafts.\n` +
          `Type **/resume** to restart them anytime, or send any topic to generate a post on-demand!`,
        { parse_mode: "Markdown" }
      );
    });

    this.bot.command("resume", async (ctx) => {
      const chatId = String(ctx.chat.id);
      await this.usersService.setSchedulingPaused(chatId, false);
      const user = await this.usersService.getUser(chatId);
      const sched = user?.postingSchedule || { frequency: "daily", preferredHour: 19 };
      const label =
        sched.frequency === "test_2min"
          ? "Every 2 Minutes (🧪 Test Mode)"
          : `${sched.frequency} at ${sched.preferredHour}:00`;
      await ctx.reply(
        `▶️ **Automated Postings Resumed!**\n\n` +
          `Schedule: **${label}**\n` +
          `Draft previews will arrive according to your cadence for human approval.`,
        { parse_mode: "Markdown" }
      );
    });

    this.bot.command("status", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const user = await this.usersService.getUser(chatId);
      const sched = user?.postingSchedule || { frequency: "daily", preferredHour: 19 };
      const isPaused = Boolean(user?.schedulingPaused);
      const isConnected = Boolean(user?.linkedIn?.accessToken);
      const schedLabel =
        sched.frequency === "test_2min"
          ? "Every 2 Minutes (🧪 Test Mode)"
          : `${sched.frequency} at ${sched.preferredHour}:00`;

      await ctx.reply(
        `📊 **LinkedIn AutoPilot Status**\n\n` +
          `👤 **User:** ${user?.name || "Member"}\n` +
          `💼 **Roles:** ${user?.positions?.join(", ") || user?.role || "Not configured"}\n` +
          `🛠️ **Skills:** ${user?.skills?.join(", ") || "Not configured"}\n` +
          `⏰ **Schedule:** ${schedLabel}\n` +
          `⏸️ **Automation:** ${isPaused ? "🔴 PAUSED (/resume to activate)" : "🟢 ACTIVE"}\n` +
          `🔗 **LinkedIn:** ${isConnected ? `✅ Connected (${user.linkedIn.profileName || "Ready"})` : "❌ Not Connected"}\n\n` +
          `Useful commands: /schedule, /pause, /resume`,
        { parse_mode: "Markdown" }
      );
    });

    this.bot.command("schedule", async (ctx) => {
      await this.promptScheduleQuestion(ctx);
    });

    this.bot.command("clear", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const count = await this.draftsService.clearPendingDrafts(chatId);
      await ctx.reply(
        `🧹 **Cleared ${count} Pending Draft(s)!**\n\n` +
          `Your queue is now clean and ready for new post drafts.`,
        { parse_mode: "Markdown" }
      );
    });

    // ----------------------------------------------------
    // User Photo / Image Upload Listener
    // ----------------------------------------------------
    this.bot.on(["photo", "document"], async (ctx) => {
      const chatId = String(ctx.chat.id);
      const draftId = this.awaitingImageForDraft.get(chatId);
      if (!draftId) {
        return;
      }

      try {
        await ctx.reply(`⏳ Processing and replacing image for draft **${draftId}**...`, {
          parse_mode: "Markdown",
        });

        let fileId: string | null = null;
        const msg: any = ctx.message;
        if (msg.photo && msg.photo.length > 0) {
          fileId = msg.photo[msg.photo.length - 1].file_id;
        } else if (msg.document && msg.document.mime_type?.startsWith("image/")) {
          fileId = msg.document.file_id;
        }

        if (!fileId) {
          await ctx.reply("⚠️ Please send a valid image (JPEG or PNG).");
          return;
        }

        const fileLink = await ctx.telegram.getFileLink(fileId);
        const res = await fetch(fileLink.href);
        if (!res.ok) throw new Error("Failed to download image from Telegram");

        const buffer = Buffer.from(await res.arrayBuffer());
        const imagesDir = path.resolve(process.cwd(), "data/images");
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

        const filename = `${draftId}-custom-${Date.now()}.jpg`;
        const localPath = path.join(imagesDir, filename);
        fs.writeFileSync(localPath, buffer);

        const updatedDraft = await this.draftsService.updateDraftMedia(draftId, {
          type: "image",
          url: `/data/images/${filename}`,
          localPath,
          prompt: "User custom image upload",
          source: "user_upload",
        });

        this.awaitingImageForDraft.delete(chatId);

        await ctx.reply(`✅ Visual replaced successfully! Updated draft preview below:`, {
          parse_mode: "Markdown",
        });

        const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";
        await this.sendDraftPreview(chatId, {
          draftId: updatedDraft.draftId,
          postType: updatedDraft.postType || "SHORT_POST",
          text: updatedDraft.text,
          topic: updatedDraft.metadata?.topic,
          previewUrl: `${baseUrl}/drafts/${updatedDraft.draftId}`,
          approvalUrl: `${baseUrl}/drafts/${updatedDraft.draftId}/approve`,
          localImagePath: localPath,
          prompt: "Custom image uploaded by you",
        });
      } catch (err: any) {
        this.logger.error(`Failed to replace custom image: ${err.message}`);
        await ctx.reply(`❌ Failed to update image: ${err.message}`);
      }
    });

    // ----------------------------------------------------
    // Approval & Skip Handlers
    // ----------------------------------------------------
    this.bot.action(/^approve_(.+)$/, async (ctx) => {
      const draftId = ctx.match[1];
      try {
        await this.draftsService.approveDraft(draftId, `telegram_${ctx.from.id}`);
        await ctx.answerCbQuery("✅ Post Approved! Publishing...");

        await ctx.reply(`✅ Draft **${draftId}** approved! Publishing to LinkedIn now...`, {
          parse_mode: "Markdown",
        });

        const pub = await this.publisher.publishApprovedDraft(draftId);
        await ctx.reply(
          `🚀 **Successfully Published to LinkedIn!**\n\n` +
            `Post ID: \`${pub.postId}\`\n\n` +
            `Your post is now live on your LinkedIn feed! 🎉`,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        this.logger.error(`Approve error: ${err.message}`);
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
        this.logger.error(`Reject error: ${err.message}`);
        await ctx.answerCbQuery(`Error: ${err.message}`);
        await ctx.reply(`⚠️ Skip error: ${err.message}`);
      }
    });

    // ----------------------------------------------------
    // Text Messages Router
    // ----------------------------------------------------
    this.bot.on("text", async (ctx) => {
      const text = ctx.message.text.trim();
      const chatId = String(ctx.chat.id);

      if (text.startsWith("/")) return;

      const user = await this.usersService.getUser(chatId);
      const step = user?.onboardingStep || "COMPLETED";

      // If user is currently in Q1 (Name)
      if (step === "NAME") {
        await this.usersService.updateUser(chatId, { name: text, onboardingStep: "POSITION" });
        await ctx.reply(`Nice to meet you, **${text}**!`, { parse_mode: "Markdown" });
        await this.promptPositionQuestion(ctx, user?.positions || []);
        return;
      }

      // If user is currently in Q4 (Custom background bio)
      if (step === "CUSTOM_DATA") {
        await this.usersService.updateUser(chatId, { bioContext: text, onboardingStep: "SCHEDULE" });
        await ctx.reply(`✅ Voice & background saved!`, { parse_mode: "Markdown" });
        await this.promptScheduleQuestion(ctx);
        return;
      }

      // Otherwise: Treat message as an ON-DEMAND POST GENERATION PROMPT!
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
        const content = await this.contentService.generatePost(text, chatId);
        const imgResult = await this.imageService.generateImage(content.imagePrompt, {
          userPhotoUrl: user.professionalPhotoPath,
          preferFaceReference: Boolean(user.professionalPhotoPath),
        });

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
        this.logger.error(`Error generating draft from Telegram: ${err.message}`);
        await ctx.reply(`❌ Failed to generate draft: ${err.message}`);
      }
    });
  }

  private async promptPositionQuestion(ctx: any, selected: string[] = []) {
    await ctx.reply(
      `💼 **Question 2 of 5: What is your primary role/position?**\n` +
        `*(Multi-select: Tap all that apply, then tap Save & Continue)*`,
      {
        parse_mode: "Markdown",
        ...this.buildPositionsKeyboard(selected),
      }
    );
  }

  private async promptSkillsQuestion(ctx: any, selected: string[] = []) {
    await ctx.reply(
      `🛠️ **Question 3 of 5: What are your key technical skills & interests?**\n` +
        `*(Multi-select: Tap all that apply, then tap Save & Continue)*`,
      {
        parse_mode: "Markdown",
        ...this.buildSkillsKeyboard(selected),
      }
    );
  }

  private async promptScheduleQuestion(ctx: any) {
    await ctx.reply(
      `⏰ **Question 5 of 5: How would you like to schedule your posts?**\n\n` +
        `Select your preferred schedule for daily automated drafting:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🌅 Daily at 9:00 AM", "sched_9")],
          [Markup.button.callback("☀️ Daily at 1:00 PM", "sched_13")],
          [Markup.button.callback("🌙 Daily at 7:00 PM", "sched_19")],
          [Markup.button.callback("⚡ Whenever Ready (Auto-Morning)", "sched_auto")],
          [Markup.button.callback("📅 3x a Week (Mon / Wed / Fri)", "sched_3x")],
          [Markup.button.callback("🧪 Every 2 Minutes (Testing)", "sched_2min")],
          [Markup.button.callback("⏸️ Pause Automated Posts", "sched_pause")],
        ]),
      }
    );
  }

  private async showCompletionCard(ctx: any, chatId: string, scheduleLabel: string) {
    const user = await this.usersService.getUser(chatId);
    const positions = user?.positions?.join(", ") || user?.role || "Developer";
    const skills = user?.skills?.join(", ") || "Systems & Cloud";
    const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";
    const authUrl = `${baseUrl}/auth/linkedin?userId=${chatId}`;

    const summary =
      `🎉 **Setup Complete! Your Profile is Configured:**\n\n` +
      `👤 **Name:** ${user?.name || "Professional"}\n` +
      `💼 **Roles:** ${positions}\n` +
      `🛠️ **Skills:** ${skills}\n` +
      `⏰ **Schedule:** ${scheduleLabel}\n` +
      `${user?.bioContext ? `📝 **Voice Background:** ${user.bioContext}\n` : ""}\n` +
      `──────────────────────────────`;

    if (!user?.linkedIn?.accessToken) {
      if (this.isValidTelegramButtonUrl(authUrl)) {
        await ctx.reply(
          `${summary}\n\n` +
            `👉 **Final Step:** Tap below to link your LinkedIn account (0 keys needed):`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.url("🔗 Connect LinkedIn Profile", authUrl)],
            ]),
          }
        );
      } else {
        await ctx.reply(
          `${summary}\n\n` +
            `👉 **Final Step:** Connect your LinkedIn profile:\n\n` +
            `👉 **[Click Here to Connect LinkedIn](${authUrl})**`,
          { parse_mode: "Markdown" }
        );
      }
    } else {
      await ctx.reply(
        `${summary}\n\n` +
          `✅ **LinkedIn Account Connected!**\n\n` +
          `Your automated posts will arrive based on your schedule (**${scheduleLabel}**).\n` +
          `Or, you can send me **any topic right now** to generate an instant post!`,
        { parse_mode: "Markdown" }
      );
    }
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
      [
        Markup.button.callback("🖼️ Replace With My Image", `custom_img_${payload.draftId}`),
      ],
    ];

    if (isButtonUrlValid) {
      keyboardRows.push([Markup.button.url("📱 Full Web Preview", payload.previewUrl)]);
    }

    const buttons = Markup.inlineKeyboard(keyboardRows);

    try {
      if (payload.localImagePath && fs.existsSync(payload.localImagePath)) {
        await this.bot.telegram.sendPhoto(
          channelUserId,
          { source: payload.localImagePath },
          {
            caption,
            parse_mode: "Markdown",
            ...buttons,
          }
        );
      } else if (payload.imageUrl) {
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
