import { Module } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";
import { HuggingFaceProvider } from "./huggingface.provider";
import { GeminiImageProvider } from "./gemini-image.provider";
import { ImageService } from "./image.service";

@Module({
  providers: [PollinationsProvider, FalAiProvider, HuggingFaceProvider, GeminiImageProvider, ImageService],
  exports: [ImageService, PollinationsProvider, FalAiProvider, HuggingFaceProvider, GeminiImageProvider],
})
export class ImageModule {}

