import { Module } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";
import { ImageService } from "./image.service";

@Module({
  providers: [PollinationsProvider, FalAiProvider, ImageService],
  exports: [ImageService, PollinationsProvider, FalAiProvider],
})
export class ImageModule {}

