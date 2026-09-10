import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { DraftsService } from "../drafts/drafts.service";
import { ImageService } from "../image/image.service";
import { TelegramService } from "../channels/telegram/telegram.service";
import { LinkedInPublisherService } from "../linkedin/linkedin-publisher.service";

@Injectable()
export class DailyPosterService {
  private readonly logger = new Logger(DailyPosterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly draftsService: DraftsService,
    private readonly imageService: ImageService,
    private readonly telegramService: TelegramService,
    private readonly publisher: LinkedInPublisherService
  ) {}

  /**
   * Daily scheduled cron job.
   * Runs every day at 10:00 AM server time.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleDailyCron() {
    this.logger.log("Executing Daily LinkedIn Cron Job...");
    const activeUsers = await this.usersService.getAllActiveUsers();

    if (activeUsers.length === 0) {
      this.logger.log("No active onboarded users with LinkedIn tokens found.");
      return;
    }

    for (const user of activeUsers) {
      try {
        await this.processUserDailyDraft(user);
      } catch (err: any) {
        this.logger.error(`Error processing daily draft for user ${user.telegramUserId}: ${err.message}`);
      }
    }
  }

  async processUserDailyDraft(user: any) {
    const userId = user.telegramUserId;
    const baseUrl = this.config.get<string>("baseUrl");

    // Check if user already has an unreviewed draft today
    const pendingDrafts = await this.draftsService.listDrafts({ userId, status: "PENDING_APPROVAL" });
    if (pendingDrafts.length > 0) {
      this.logger.log(`User ${userId} already has ${pendingDrafts.length} pending draft(s). Skipping automatic generation.`);
      return;
    }

    // Pick topic from user preferences
    const topic = user.topics && user.topics.length > 0
      ? user.topics[Math.floor(Math.random() * user.topics.length)]
      : "Software Engineering Architecture";

    this.logger.log(`Generating daily draft for user ${user.name} (${userId}) on topic: ${topic}`);

    // Generate visual via Image Service
    const imageResult = await this.imageService.generateImage(
      `Modern software architecture diagram and clean developer workspace for ${topic}`,
      {
        userPhotoUrl: user.professionalPhotoPath,
        preferFaceReference: Boolean(user.professionalPhotoPath),
      }
    );

    // Initial draft text placeholder (Hermes agent or LLM will populate this when connected)
    const draftText =
      `What we learned designing resilient architecture for ${topic}:\n\n` +
      `When scaling production services, the biggest bottlenecks rarely come from the framework itself — ` +
      `they come from boundary layers: database connection pooling, cache invalidation timing, and unindexed queries.\n\n` +
      `3 rules we stick to:\n` +
      `1. Never cache what changes unpredictably without explicit invalidation.\n` +
      `2. Set query timeouts at the client layer, not just the database.\n` +
      `3. Measure p95 latency under real concurrency, not average response time.\n\n` +
      `What's been your biggest lesson scaling ${topic}?`;

    const draft = await this.draftsService.createDraft({
      userId,
      text: draftText,
      topic,
      media: {
        type: "image",
        url: imageResult.url,
        localPath: imageResult.localPath,
        prompt: imageResult.prompt,
      },
    });

    // Notify user in Telegram
    await this.telegramService.sendDraftPreview(userId, {
      draftId: draft.draftId,
      postType: "SHORT_POST",
      text: draft.text,
      topic: draft.metadata?.topic,
      previewUrl: `${baseUrl}/drafts/${draft.draftId}`,
      approvalUrl: `${baseUrl}/drafts/${draft.draftId}/approve`,
      imageUrl: imageResult.url,
      prompt: imageResult.prompt,
    });

    this.logger.log(`Draft ${draft.draftId} created and sent to Telegram user ${userId}.`);
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

