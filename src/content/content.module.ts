import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}

