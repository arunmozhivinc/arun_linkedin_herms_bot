import { Injectable, Logger } from "@nestjs/common";
import { LinkedInClient } from "./linkedin.client";

@Injectable()
export class LinkedInPostsService {
  private readonly logger = new Logger(LinkedInPostsService.name);

  constructor(private readonly client: LinkedInClient) {}

  async publishPost(options: {
    accessToken: string;
    authorUrn: string;
    commentary: string;
    mediaImageUrn?: string;
    title?: string;
  }): Promise<{ postId: string; authorUrn: string }> {
    const { accessToken, authorUrn, commentary, mediaImageUrn, title = "Visual" } = options;

    if (!commentary || commentary.trim().length === 0) {
      throw new Error("Post commentary cannot be empty.");
    }

    const payload: any = {
      author: authorUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (mediaImageUrn) {
      payload.content = {
        media: {
          title,
          id: mediaImageUrn,
        },
      };
    }

    this.logger.log(`Publishing post to LinkedIn for author ${authorUrn}...`);
    const response = await this.client.request("https://api.linkedin.com/rest/posts", {
      method: "POST",
      token: accessToken,
      body: payload,
    });

    const postId = response.headers.get("x-restli-id") || "published";
    this.logger.log(`LinkedIn post published successfully! Post ID: ${postId}`);

    return {
      postId,
      authorUrn,
    };
  }
}

