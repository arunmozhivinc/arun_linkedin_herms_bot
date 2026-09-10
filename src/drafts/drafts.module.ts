import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { DraftsService } from "./drafts.service";
import { DraftsController } from "./drafts.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [DraftsController],
  providers: [DraftsService],
  exports: [DraftsService],
})
export class DraftsModule {}

