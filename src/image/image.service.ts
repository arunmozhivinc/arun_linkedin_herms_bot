import { Injectable, Logger } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";
import { HuggingFaceProvider } from "./huggingface.provider";
import { GeminiImageProvider } from "./gemini-image.provider";

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly pollinations: PollinationsProvider,
    private readonly falAi: FalAiProvider,
    private readonly huggingFace: HuggingFaceProvider,
    private readonly geminiImage: GeminiImageProvider
  ) {}

  async generateImage(
    prompt: string,
    options: {
      draftId?: string;
      userPhotoUrl?: string;
      preferFaceReference?: boolean;
    } = {}
  ): Promise<{
    url: string;
    localPath: string;
    prompt: string;
    provider: "gemini" | "huggingface" | "pollinations" | "falai" | "user_upload";
  } | null> {
    // 1. Google Imagen 3 via Gemini API (if enabled with billing on Google Cloud)
    if (this.geminiImage.isConfigured()) {
      try {
        const geminiResult = await this.geminiImage.generateAndSave(prompt, options.draftId);
        return {
          ...geminiResult,
          provider: "gemini",
        };
      } catch (err: any) {
        this.logger.warn(`Google Imagen 3 generation failed: ${err.message}`);
      }
    }

    // 2. HuggingFace Inference API (if dedicated endpoint configured)
    if (this.huggingFace.isConfigured()) {
      try {
        const hfResult = await this.huggingFace.generateAndSave(prompt, options.draftId);
        return {
          ...hfResult,
          provider: "huggingface",
        };
      } catch (err: any) {
        this.logger.warn(`HuggingFace generation failed: ${err.message}`);
      }
    }

    // 3. Face-Reference: Fal.ai (if user uploaded a photo and Fal.ai is enabled)
    if (options.preferFaceReference && options.userPhotoUrl && this.falAi.isConfigured()) {
      const falResult = await this.falAi.generateFaceReferenceImage(
        prompt,
        options.userPhotoUrl,
        options.draftId
      );
      if (falResult) {
        return {
          ...falResult,
          provider: "falai",
        };
      }
    }

    // Pollinations disabled per user instruction. No automated fallback.
    this.logger.log(
      "Image generation: No active image provider succeeded; drafting post without AI visual. User can attach a custom image."
    );
    return null;
  }

  getPreviewUrl(prompt: string): string {
    return "";
  }
}

