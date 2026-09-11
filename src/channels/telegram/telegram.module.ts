import { Module, forwardRef } from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import { UsersModule } from "../../users/users.module";
import { DraftsModule } from "../../drafts/drafts.module";
import { ContentModule } from "../../content/content.module";
import { ImageModule } from "../../image/image.module";
import { LinkedInModule } from "../../linkedin/linkedin.module";
import { TelegramController } from "./telegram.controller";

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => DraftsModule),
    ContentModule,
    ImageModule,
    LinkedInModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
