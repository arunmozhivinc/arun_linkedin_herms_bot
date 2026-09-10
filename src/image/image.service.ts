import { Injectable, Logger } from "@nestjs/common";
import { PollinationsProvider } from "./pollinations.provider";
import { FalAiProvider } from "./falai.provider";

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly pollinations: PollinationsProvider,
    private readonly falAi: FalAiProvider
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
    provider: "pollinations" | "falai";
  }> {
    // 1. If user uploaded a photo and Fal.ai is enabled, try face-reference generation
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

    // 2. Default: Zero-cost, high-reliability Pollinations.ai Flux generation
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

