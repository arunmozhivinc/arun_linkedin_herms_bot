import { Injectable, Logger } from "@nestjs/common";
import { LinkedInClient } from "./linkedin.client";

@Injectable()
export class LinkedInArticlesService {
  private readonly logger = new Logger(LinkedInArticlesService.name);

  constructor(private readonly client: LinkedInClient) {}

  /**
   * Scaffolding for publishing long-form LinkedIn Articles.
   * Ready for next version expansion.
   */
  async publishArticle(options: {
    accessToken: string;
    authorUrn: string;
    title: string;
    bodyMarkdown: string;
    coverImageUrn?: string;
  }): Promise<{ articleId: string; authorUrn: string }> {
    this.logger.log(`Preparing LinkedIn Article: "${options.title}"...`);
    // LinkedIn Articles API integration placeholder for v3
    throw new Error("LinkedIn Article publishing is scheduled for v3. Currently supporting visual short posts.");
  }
}

