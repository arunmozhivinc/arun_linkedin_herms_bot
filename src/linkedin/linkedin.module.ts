import { Module, forwardRef } from "@nestjs/common";
import { LinkedInClient } from "./linkedin.client";
import { LinkedInOAuthService } from "./linkedin-oauth.service";
import { LinkedInMediaService } from "./linkedin-media.service";
import { LinkedInPostsService } from "./linkedin-posts.service";
import { LinkedInArticlesService } from "./linkedin-articles.service";
import { LinkedInPublisherService } from "./linkedin-publisher.service";
import { LinkedInController } from "./linkedin.controller";
import { UsersModule } from "../users/users.module";
import { DraftsModule } from "../drafts/drafts.module";

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => DraftsModule)],
  controllers: [LinkedInController],
  providers: [
    LinkedInClient,
    LinkedInOAuthService,
    LinkedInMediaService,
    LinkedInPostsService,
    LinkedInArticlesService,
    LinkedInPublisherService,
  ],
  exports: [
    LinkedInClient,
    LinkedInOAuthService,
    LinkedInMediaService,
    LinkedInPostsService,
    LinkedInArticlesService,
    LinkedInPublisherService,
  ],
})
export class LinkedInModule {}
