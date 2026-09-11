import { Module } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";
import { HuggingFaceProvider } from "./huggingface.provider";
import { ImageService } from "./image.service";

@Module({
  providers: [PollinationsProvider, FalAiProvider, HuggingFaceProvider, ImageService],
  exports: [ImageService, PollinationsProvider, FalAiProvider, HuggingFaceProvider],
})
export class ImageModule {}

