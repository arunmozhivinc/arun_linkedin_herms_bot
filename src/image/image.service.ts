import { Injectable, Logger } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";
import { HuggingFaceProvider } from "./huggingface.provider";

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly pollinations: PollinationsProvider,
    private readonly falAi: FalAiProvider,
    private readonly huggingFace: HuggingFaceProvider
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
    provider: "huggingface" | "pollinations" | "falai" | "user_upload";
  }> {
    // 1. Primary: HuggingFace Inference API (if token configured)
    if (this.huggingFace.isConfigured()) {
      try {
        const hfResult = await this.huggingFace.generateAndSave(prompt, options.draftId);
        return {
          ...hfResult,
          provider: "huggingface",
        };
      } catch (err: any) {
        this.logger.warn(`HuggingFace generation failed: ${err.message}; falling back to Pollinations/Fal`);
      }
    }

    // 2. If user uploaded a photo and Fal.ai is enabled, try face-reference generation
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
      this.logger.warn("Face reference generation fell back to Pollinations.ai");
    }

    // 3. Fallback: Zero-cost, high-reliability Pollinations.ai Flux generation with 7-layer brand rules
    const polResult = await this.pollinations.generateAndSave(prompt, options.draftId);
    return {
      ...polResult,
      provider: "pollinations",
    };
  }

  getPreviewUrl(prompt: string): string {
    return this.pollinations.getDirectUrl(prompt);
  }
}

