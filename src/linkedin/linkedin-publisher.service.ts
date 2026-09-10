import { Injectable, Logger } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { DraftsService } from "../drafts/drafts.service";
import { LinkedInMediaService } from "./linkedin-media.service";
import { LinkedInPostsService } from "./linkedin-posts.service";

@Injectable()
export class LinkedInPublisherService {
  private readonly logger = new Logger(LinkedInPublisherService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly draftsService: DraftsService,
    private readonly mediaService: LinkedInMediaService,
    private readonly postsService: LinkedInPostsService
  ) {}

  async publishApprovedDraft(draftId: string): Promise<any> {
    const draft = await this.draftsService.validateForPublishing(draftId);
    const user = await this.usersService.getUser(draft.userId);

    if (!user || !user.linkedIn?.accessToken) {
      throw new Error(`User ${draft.userId} is not authenticated with LinkedIn.`);
    }

    const token = user.linkedIn.accessToken;
    const authorUrn = user.linkedIn.memberUrn;

    let mediaImageUrn: string | undefined;

    if (draft.media?.localPath) {
      mediaImageUrn = await this.mediaService.uploadImage(token, authorUrn, draft.media.localPath);
    }

    const result = await this.postsService.publishPost({
      accessToken: token,
      authorUrn,
      commentary: draft.text,
      mediaImageUrn,
      title: draft.metadata?.topic || "Visual",
    });

    await this.draftsService.markPublished(draftId, result.postId, authorUrn);
    return result;
  }
}

