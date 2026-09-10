import "dotenv/config";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { UsersModule } from "./users/users.module";
import { DraftsModule } from "./drafts/drafts.module";
import { LinkedInModule } from "./linkedin/linkedin.module";
import { ImageModule } from "./image/image.module";
import { ChannelsModule } from "./channels/channels.module";
import { CronModule } from "./cron/cron.module";
import { McpModule } from "./mcp/mcp.module";
import { ContentModule } from "./content/content.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule.forRoot(),
    UsersModule,
    DraftsModule,
    LinkedInModule,
    ImageModule,
    ContentModule,
    ChannelsModule,
    CronModule,
    McpModule,
  ],
})
export class AppModule {}

