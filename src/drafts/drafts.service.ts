import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Draft, DraftDocument } from "./schemas/draft.schema";

@Injectable()
export class DraftsService {
  private readonly logger = new Logger(DraftsService.name);
  private readonly localDraftsFile = path.resolve(process.cwd(), "data/drafts.json");
  private localDrafts: Map<string, any> = new Map();

  constructor(
    @Optional()
    @InjectModel(Draft.name)
    private readonly draftModel?: Model<DraftDocument>
  ) {
    this.loadLocalFallback();
  }

  private loadLocalFallback() {
    try {
      const dir = path.dirname(this.localDraftsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.localDraftsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.localDraftsFile, "utf8"));
        const list = Array.isArray(raw) ? raw : raw.drafts || [];
        for (const d of list) {
          this.localDrafts.set(d.draftId || d.id, d);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Could not load local drafts: ${e.message}`);
    }
  }

  private saveLocalFallback() {
    try {
      const list = Array.from(this.localDrafts.values());
      fs.writeFileSync(this.localDraftsFile, JSON.stringify({ drafts: list }, null, 2), "utf8");
    } catch (e: any) {
      this.logger.error(`Failed to save local drafts: ${e.message}`);
    }
  }

  computeContentHash(content: { text: string; mediaPath?: string }): string {
    const text = (content.text || "").trim();
    const mediaPath = (content.mediaPath || "").trim();
    return crypto.createHash("sha256").update(`${text}|${mediaPath}`, "utf8").digest("hex");
  }

  generateDraftId(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `GL-${yyyy}${mm}${dd}`;

    let maxSeq = 0;
    for (const d of this.localDrafts.values()) {
      const id = d.draftId || d.id || "";
      if (id.startsWith(prefix)) {
        const seq = parseInt(id.split("-")[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    return `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;
  }

  async createDraft(options: {
    userId: string;
    text: string;
    postType?: "SHORT_POST" | "ARTICLE";
    media?: any;
    topic?: string;
    tags?: string[];
    archetype?: string;
  }): Promise<any> {
    const { userId, text, postType = "SHORT_POST", media = null, topic = "General", tags = [], archetype } = options;

    if (!text || text.trim().length === 0) {
      throw new Error("Draft text cannot be empty.");
    }

    const draftId = this.generateDraftId();
    const contentHash = this.computeContentHash({ text, mediaPath: media?.localPath || media?.path || media?.url });

    const draftPayload = {
      draftId,
      userId,
      postType,
      status: "PENDING_APPROVAL",
      text: text.trim(),
      media,
      metadata: {
        topic,
        tags,
        archetype,
      },
      contentHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      publishedAt: null,
      postId: null,
      authorUrn: null,
    };

    if (this.draftModel) {
      try {
        const created = await this.draftModel.create(draftPayload);
        this.localDrafts.set(draftId, created.toObject());
        this.saveLocalFallback();
        return created.toObject();
      } catch (err: any) {
        this.logger.warn(`Mongoose draft create failed: ${err.message}`);
      }
    }

    this.localDrafts.set(draftId, draftPayload);
    this.saveLocalFallback();
    return draftPayload;
  }

  async getDraft(draftId: string): Promise<any | null> {
    if (this.draftModel) {
      try {
        const draft = await this.draftModel.findOne({
          $or: [{ draftId }, { id: draftId }],
        });
        if (draft) return draft.toObject();
      } catch (e: any) {
        this.logger.warn(`Mongoose getDraft error: ${e.message}`);
      }
    }

    if (!this.localDrafts.has(draftId)) {
      this.loadLocalFallback();
    }
    return this.localDrafts.get(draftId) || null;
  }

  async listDrafts(filter: { userId?: string; status?: string } = {}): Promise<any[]> {
    if (this.draftModel) {
      try {
        const q: any = {};
        if (filter.userId) q.userId = filter.userId;
        if (filter.status && filter.status !== "ALL") q.status = filter.status;
        const drafts = await this.draftModel.find(q).sort({ createdAt: -1 });
        if (drafts.length > 0) return drafts.map((d) => d.toObject());
      } catch {
        // fallback
      }
    }

    this.loadLocalFallback();
    return Array.from(this.localDrafts.values()).filter((d) => {
      if (filter.userId && d.userId !== filter.userId) return false;
      if (filter.status && filter.status !== "ALL" && d.status !== filter.status) return false;
      return true;
    });
  }

  async approveDraft(draftId: string, approvedBy = "user"): Promise<any> {
    const draft = await this.getDraft(draftId);
    if (!draft) throw new Error(`Draft "${draftId}" not found.`);
    if (draft.status === "PUBLISHED") throw new Error(`Draft "${draftId}" is already published.`);

    const updates = {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy,
    };

    if (this.draftModel) {
      try {
        const updated = await this.draftModel.findOneAndUpdate(
          { $or: [{ draftId }, { id: draftId }] },
          { $set: updates },
          { new: true }
        );
        if (updated) {
          this.localDrafts.set(draftId, updated.toObject());
          this.saveLocalFallback();
          return updated.toObject();
        }
      } catch {
        // fallback
      }
    }

    const updated = { ...draft, ...updates, updatedAt: new Date().toISOString() };
    this.localDrafts.set(draftId, updated);
    this.saveLocalFallback();
    return updated;
  }

  async rejectDraft(draftId: string, reason = "Rejected by user"): Promise<any> {
    const draft = await this.getDraft(draftId);
    if (!draft) throw new Error(`Draft "${draftId}" not found.`);
    if (draft.status === "PUBLISHED") throw new Error(`Cannot reject published draft "${draftId}".`);

    const updates = {
      status: "REJECTED",
      rejectionReason: reason,
    };

    if (this.draftModel) {
      try {
        const updated = await this.draftModel.findOneAndUpdate(
          { $or: [{ draftId }, { id: draftId }] },
          { $set: updates },
          { new: true }
        );
        if (updated) {
          this.localDrafts.set(draftId, updated.toObject());
          this.saveLocalFallback();
          return updated.toObject();
        }
      } catch {
        // fallback
      }
    }

    const updated = { ...draft, ...updates, updatedAt: new Date().toISOString() };
    this.localDrafts.set(draftId, updated);
    this.saveLocalFallback();
    return updated;
  }

  async clearPendingDrafts(userId: string): Promise<number> {
    let count = 0;
    if (this.draftModel) {
      try {
        const res = await this.draftModel.updateMany(
          { userId, status: "PENDING_APPROVAL" },
          { $set: { status: "REJECTED", rejectionReason: "Cleared by user" } }
        );
        count = res.modifiedCount || 0;
      } catch {
        // fallback below
      }
    }

    for (const [id, d] of this.localDrafts.entries()) {
      if (d.userId === userId && d.status === "PENDING_APPROVAL") {
        d.status = "REJECTED";
        d.rejectionReason = "Cleared by user";
        this.localDrafts.set(id, d);
        count++;
      }
    }
    this.saveLocalFallback();
    return count;
  }

  async updateDraftMedia(draftId: string, media: any): Promise<any> {
    const draft = await this.getDraft(draftId);
    if (!draft) throw new Error(`Draft "${draftId}" not found.`);
    if (draft.status === "PUBLISHED") throw new Error(`Cannot modify published draft "${draftId}".`);

    const newHash = this.computeContentHash({
      text: draft.text,
      mediaPath: media?.localPath || media?.path || media?.url,
    });

    const updates = {
      media,
      contentHash: newHash,
      updatedAt: new Date().toISOString(),
    };

    if (this.draftModel) {
      try {
        const updated = await this.draftModel.findOneAndUpdate(
          { $or: [{ draftId }, { id: draftId }] },
          { $set: updates },
          { new: true }
        );
        if (updated) {
          this.localDrafts.set(draftId, updated.toObject());
          this.saveLocalFallback();
          return updated.toObject();
        }
      } catch {
        // fallback
      }
    }

    const updated = { ...draft, ...updates };
    this.localDrafts.set(draftId, updated);
    this.saveLocalFallback();
    return updated;
  }

  /**
   * Airtight safety validation before publishing.
   */
  async validateForPublishing(draftId: string): Promise<any> {
    const draft = await this.getDraft(draftId);
    if (!draft) throw new Error(`Draft "${draftId}" not found in database.`);

    if (draft.status === "PUBLISHED" || draft.publishedAt) {
      throw new Error(`Safety violation: Draft "${draftId}" was already published. Duplicate publishing blocked.`);
    }

    if (draft.status === "REJECTED") {
      throw new Error(`Safety violation: Draft "${draftId}" was rejected. Publishing blocked.`);
    }

    if (draft.status !== "APPROVED") {
      throw new Error(
        `Safety violation: Draft "${draftId}" is currently "${draft.status}". It must be explicitly approved by human review before publishing.`
      );
    }

    // Tamper detection
    const currentHash = this.computeContentHash({
      text: draft.text,
      mediaPath: draft.media?.localPath || draft.media?.path || draft.media?.url,
    });
    if (currentHash !== draft.contentHash) {
      throw new Error(`Tamper detected: Draft "${draftId}" content has been modified since approval!`);
    }

    return draft;
  }

  async markPublished(draftId: string, postId: string, authorUrn: string): Promise<any> {
    const updates = {
      status: "PUBLISHED",
      publishedAt: new Date(),
      postId,
      authorUrn,
    };

    if (this.draftModel) {
      try {
        const updated = await this.draftModel.findOneAndUpdate({ draftId }, { $set: updates }, { new: true });
        if (updated) {
          this.localDrafts.set(draftId, updated.toObject());
          this.saveLocalFallback();
          return updated.toObject();
        }
      } catch {
        // fallback
      }
    }

    const draft = await this.getDraft(draftId);
    const updated = { ...draft, ...updates, updatedAt: new Date().toISOString() };
    this.localDrafts.set(draftId, updated);
    this.saveLocalFallback();
    return updated;
  }
}

