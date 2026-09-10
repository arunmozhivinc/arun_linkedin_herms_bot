import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DailyPosterService } from "./daily-poster.service";
import { UsersModule } from "../users/users.module";
import { DraftsModule } from "../drafts/drafts.module";
import { ImageModule } from "../image/image.module";
import { ChannelsModule } from "../channels/channels.module";
import { LinkedInModule } from "../linkedin/linkedin.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UsersModule,
    DraftsModule,
    ImageModule,
    ChannelsModule,
    LinkedInModule,
  ],
  providers: [DailyPosterService],
  exports: [DailyPosterService],
})
export class CronModule {}

