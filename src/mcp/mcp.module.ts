import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { DraftsModule } from "../drafts/drafts.module";
import { ImageModule } from "../image/image.module";
import { CronModule } from "../cron/cron.module";
import { ChannelsModule } from "../channels/channels.module";

@Module({
  imports: [UsersModule, DraftsModule, ImageModule, CronModule, ChannelsModule],
})
export class McpModule {}

