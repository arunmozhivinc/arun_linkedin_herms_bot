import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class FalAiProvider {
  private readonly logger = new Logger(FalAiProvider.name);
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor(private readonly config: ConfigService) {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("falAi.apiKey"));
  }

  /**
   * Generates a face-consistent visual using Fal.ai FLUX IP-Adapter.
   * If not configured, returns null so caller uses Pollinations.
   */
  async generateFaceReferenceImage(
    prompt: string,
    facePhotoUrlOrPath: string,
    draftId?: string
  ): Promise<{ url: string; localPath: string; prompt: string } | null> {
    const apiKey = this.config.get<string>("falAi.apiKey");
    if (!apiKey) {
      this.logger.warn("Fal.ai API key not configured; falling back to standard image generation.");
      return null;
    }

    try {
      this.logger.log(`Calling Fal.ai FLUX with face reference for draft ${draftId}...`);
      
      const response = await fetch("https://queue.fal.run/fal-ai/flux-pulid", {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `Professional LinkedIn developer portrait: ${prompt}, photorealistic, 8k, modern clean lighting`,
          reference_image_url: facePhotoUrlOrPath,
          image_size: "landscape_16_9",
        }),
      });

      if (!response.ok) {
        throw new Error(`Fal.ai request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Fal.ai response did not contain an image URL.");
      }

      // Download and cache locally
      const filename = draftId ? `${draftId}.jpg` : `fal_${Date.now()}.jpg`;
      const localPath = path.join(this.imagesDir, filename);

      const imgRes = await fetch(imageUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(localPath, buffer);

      return {
        url: imageUrl,
        localPath,
        prompt,
      };
    } catch (err: any) {
      this.logger.error(`Fal.ai generation error: ${err.message}`);
      return null;
    }
  }
}

