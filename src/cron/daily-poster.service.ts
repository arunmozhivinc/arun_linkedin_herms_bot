import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { DraftsService } from "../drafts/drafts.service";
import { ImageService } from "../image/image.service";
import { TelegramService } from "../channels/telegram/telegram.service";
import { LinkedInPublisherService } from "../linkedin/linkedin-publisher.service";
import { ContentService } from "../content/content.service";

@Injectable()
export class DailyPosterService {
  private readonly logger = new Logger(DailyPosterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly draftsService: DraftsService,
    private readonly imageService: ImageService,
    private readonly telegramService: TelegramService,
    private readonly publisher: LinkedInPublisherService,
    private readonly contentService: ContentService
  ) {}

  /**
   * Hourly scheduled cron job.
   * Checks each active user's timezone, scheduled preferredHour, and frequency.
   * If current hour matches user schedule, synthesizes a high-impact creator post and dispatches preview.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCron() {
    this.logger.log("Running hourly schedule check for active users...");
    const activeUsers = await this.usersService.getAllActiveUsers();

    if (activeUsers.length === 0) {
      this.logger.log("No active onboarded users with LinkedIn tokens found.");
      return;
    }

    const now = new Date();

    for (const user of activeUsers) {
      if (user.schedulingPaused) {
        continue;
      }

      try {
        const schedule = user.postingSchedule || {
          frequency: "daily",
          preferredHour: 19,
          timezone: "Asia/Kolkata",
        };
        const tz = schedule.timezone || "Asia/Kolkata";

        let userHour: number;
        let userDay: string;
        try {
          userHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: tz,
            }).format(now),
            10
          );
          userDay = new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            timeZone: tz,
          }).format(now);
        } catch {
          userHour = now.getHours();
          userDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
        }

        // 3x a week frequency (Mon, Wed, Fri only)
        if (schedule.frequency === "3x_week" && !["Mon", "Wed", "Fri"].includes(userDay)) {
          continue;
        }

        const targetHour = schedule.preferredHour !== undefined ? schedule.preferredHour : 19;
        if (userHour === targetHour) {
          this.logger.log(`Matching schedule hour (${userHour}:00) for user ${user.name} (${user.telegramUserId})`);
          await this.processUserDailyDraft(user);
        }
      } catch (err: any) {
        this.logger.error(
          `Error processing scheduled draft for user ${user.telegramUserId}: ${err.message}`
        );
      }
    }
  }

  /**
   * 2-Minute Test Cron Job.
   * Runs every 2 minutes for testing users with frequency === "test_2min" and scheduling not paused.
   */
  @Cron("*/2 * * * *")
  async handleTestTwoMinuteCron() {
    const activeUsers = await this.usersService.getAllActiveUsers();
    const testUsers = activeUsers.filter(
      (u) => u.postingSchedule?.frequency === "test_2min" && !u.schedulingPaused
    );

    if (testUsers.length === 0) return;

    this.logger.log(`Executing 2-minute test cron for ${testUsers.length} test user(s)...`);
    for (const user of testUsers) {
      try {
        await this.processUserDailyDraft(user, undefined, true);
      } catch (err: any) {
        this.logger.error(`Error in 2-min test cron for user ${user.telegramUserId}: ${err.message}`);
      }
    }
  }

  /**
   * Render Free-Tier Keep-Alive Self-Ping.
   * Pings own baseUrl every 10 minutes so Render instances never sleep after 15 min of inactivity.
   */
  @Cron("*/10 * * * *")
  async handleKeepAlivePing() {
    const baseUrl = this.config.get<string>("baseUrl");
    if (!baseUrl || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/health`);
      this.logger.log(`Render keep-alive self-ping (${baseUrl}/health): ${res.status}`);
    } catch (err: any) {
      this.logger.warn(`Render keep-alive ping failed: ${err.message}`);
    }
  }

  /**
   * Generates a creator-style draft post and sends preview to user's Telegram.
   */
  async processUserDailyDraft(user: any, customPrompt?: string, isTest = false) {
    const userId = user.telegramUserId;
    const baseUrl = this.config.get<string>("baseUrl") || "http://localhost:3000";

    // Check if user already has an unreviewed pending draft (only in production schedule, bypassed in test mode)
    if (!customPrompt && !isTest) {
      const pendingDrafts = await this.draftsService.listDrafts({ userId, status: "PENDING_APPROVAL" });
      if (pendingDrafts.length > 0) {
        this.logger.log(
          `User ${userId} already has ${pendingDrafts.length} pending draft(s). Skipping automatic generation.`
        );
        return;
      }

      const recentDrafts = await this.draftsService.listDrafts({ userId });
      const createdRecently = recentDrafts.some((d: any) => {
        const diffHours = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60);
        return diffHours < 18;
      });
      if (createdRecently) {
        this.logger.log(`User ${userId} already received a draft recently. Skipping automatic generation.`);
        return;
      }
    }

    this.logger.log(`Synthesizing creator content for user ${user.name} (${userId})...`);

    // 1. Synthesize content based on user's selected skills, bio context, and creator archetypes
    const content = await this.contentService.generatePost(customPrompt || "", userId);

    // 2. Generate high-quality visual via HuggingFace (primary) or Pollinations.ai (fallback)
    const imageResult = await this.imageService.generateImage(content.imagePrompt, {
      userPhotoUrl: user.professionalPhotoPath,
      preferFaceReference: Boolean(user.professionalPhotoPath),
    });

    // 3. Store draft in MongoDB with PENDING_APPROVAL status
    const draft = await this.draftsService.createDraft({
      userId,
      text: content.text,
      topic: content.topic,
      tags: content.tags,
      media: {
        type: "image",
        url: imageResult.url,
        localPath: imageResult.localPath,
        prompt: imageResult.prompt,
        provider: imageResult.provider,
      },
    });

    // 4. Send interactive draft preview with [✅ Approve], [❌ Skip], & [🖼️ Replace Image] directly in Telegram
    await this.telegramService.sendDraftPreview(userId, {
      draftId: draft.draftId,
      postType: "SHORT_POST",
      text: draft.text,
      topic: draft.metadata?.topic,
      previewUrl: `${baseUrl}/drafts/${draft.draftId}`,
      approvalUrl: `${baseUrl}/drafts/${draft.draftId}/approve`,
      imageUrl: imageResult.url?.startsWith("http") ? imageResult.url : undefined,
      localImagePath: imageResult.localPath,
      prompt: imageResult.prompt,
    });

    this.logger.log(`Draft ${draft.draftId} created and dispatched to Telegram user ${userId}.`);
    return draft;
  }

  /**
   * Publishes an approved draft directly.
   */
  async publishApprovedDraft(draftId: string): Promise<any> {
    const result = await this.publisher.publishApprovedDraft(draftId);
    const draft = await this.draftsService.getDraft(draftId);
    if (draft) {
      await this.telegramService.sendPublishSuccess(draft.userId, draftId, result.postId);
    }
    return result;
  }
}

