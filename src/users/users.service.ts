import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly localUsersFile = path.resolve(process.cwd(), "data/users.json");
  private localUsers: Map<string, any> = new Map();

  constructor(
    @Optional()
    @InjectModel(User.name)
    private readonly userModel?: Model<UserDocument>
  ) {
    this.loadLocalFallback();
  }

  private loadLocalFallback() {
    try {
      const dir = path.dirname(this.localUsersFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.localUsersFile)) {
        const raw = JSON.parse(fs.readFileSync(this.localUsersFile, "utf8"));
        if (Array.isArray(raw)) {
          for (const u of raw) {
            this.localUsers.set(u.telegramUserId, u);
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Could not load local users cache: ${e.message}`);
    }
  }

  private saveLocalFallback() {
    try {
      const list = Array.from(this.localUsers.values());
      fs.writeFileSync(this.localUsersFile, JSON.stringify(list, null, 2), "utf8");
    } catch (e: any) {
      this.logger.error(`Failed to save local users cache: ${e.message}`);
    }
  }

  async findOrCreateUser(telegramUserId: string, name = "User"): Promise<any> {
    if (this.userModel) {
      try {
        let user = await this.userModel.findOne({ telegramUserId });
        if (!user) {
          user = await this.userModel.create({
            telegramUserId,
            name,
            role: "Software Professional",
            topics: ["Software Engineering", "Full-Stack Development", "Cloud Architecture"],
            skills: ["TypeScript", "Node.js", "Cloud"],
            postingSchedule: {
              frequency: "daily",
              preferredHour: 10,
              timezone: "Asia/Kolkata",
            },
          });
        }
        return user.toObject();
      } catch (err: any) {
        this.logger.warn(`Mongoose lookup failed, using local store: ${err.message}`);
      }
    }

    // Local fallback
    if (!this.localUsers.has(telegramUserId)) {
      const newUser = {
        telegramUserId,
        name,
        role: "Software Professional",
        topics: ["Software Engineering", "Full-Stack Development", "Cloud Architecture"],
        skills: ["TypeScript", "Node.js", "Cloud"],
        postingSchedule: {
          frequency: "daily",
          preferredHour: 10,
          timezone: "Asia/Kolkata",
        },
        linkedIn: null,
        isOnboarded: false,
        createdAt: new Date().toISOString(),
      };
      this.localUsers.set(telegramUserId, newUser);
      this.saveLocalFallback();
    }
    return this.localUsers.get(telegramUserId);
  }

  async getUser(telegramUserId: string): Promise<any | null> {
    if (this.userModel) {
      try {
        const user = await this.userModel.findOne({ telegramUserId });
        if (user) return user.toObject();
      } catch {
        // Fallback below
      }
    }
    return this.localUsers.get(telegramUserId) || null;
  }

  async updateUser(telegramUserId: string, updates: Partial<User>): Promise<any> {
    if (this.userModel) {
      try {
        const updated = await this.userModel.findOneAndUpdate(
          { telegramUserId },
          { $set: updates },
          { new: true, upsert: true }
        );
        return updated.toObject();
      } catch (err: any) {
        this.logger.warn(`Mongoose update failed: ${err.message}`);
      }
    }

    const current = (await this.findOrCreateUser(telegramUserId)) || {};
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    this.localUsers.set(telegramUserId, updated);
    this.saveLocalFallback();
    return updated;
  }

  async updateLinkedInTokens(
    telegramUserId: string,
    tokens: {
      accessToken: string;
      expiresIn: number;
      memberUrn: string;
      profileName: string;
    }
  ): Promise<any> {
    const payload = {
      linkedIn: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        savedAt: Date.now(),
        memberUrn: tokens.memberUrn,
        profileName: tokens.profileName,
      },
      isOnboarded: true,
    };
    return this.updateUser(telegramUserId, payload);
  }

  async getAllActiveUsers(): Promise<any[]> {
    if (this.userModel) {
      try {
        const users = await this.userModel.find({ "linkedIn.accessToken": { $ne: null } });
        return users.map((u) => u.toObject());
      } catch {
        // Fallback below
      }
    }
    return Array.from(this.localUsers.values()).filter((u) => u.linkedIn?.accessToken);
  }

  /**
   * Builds the authentic developer profile for Hermes dynamically per user.
   */
  async buildStyleProfile(telegramUserId?: string): Promise<any> {
    let user = telegramUserId ? await this.getUser(telegramUserId) : null;
    if (!user) {
      const active = await this.getAllActiveUsers();
      user = active[0] || (await this.findOrCreateUser("default", "Platform Member"));
    }

    return {
      author: user.name || "Software Engineer",
      role: user.role || "Full-Stack Engineer",
      topics: user.topics || ["Software Engineering"],
      skills: user.skills || ["Node.js", "TypeScript", "React", "Cloud"],
      projects: user.projects || [],
      post_structure_rules: {
        hook: "Start with an unexpected technical reality, metric, or real production lesson.",
        storytelling: "Anchor in real technical challenges and engineering trade-offs.",
        anti_patterns: [
          "In today's fast-paced digital world",
          "Game-changer",
          "Let's dive in",
          "Humbled to announce",
        ],
      },
    };
  }
}

