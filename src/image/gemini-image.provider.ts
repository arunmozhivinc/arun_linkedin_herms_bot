import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class GeminiImageProvider {
  private readonly logger = new Logger(GeminiImageProvider.name);
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor(private readonly config: ConfigService) {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  isConfigured(): boolean {
    const key = this.config.get<string>("gemini.apiKey") || process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Generates high-resolution, photorealistic visuals via Google's Imagen 3 API.
   * Model: imagen-3.0-generate-002
   */
  async generateAndSave(
    prompt: string,
    draftId?: string
  ): Promise<{
    url: string;
    localPath: string;
    prompt: string;
    width: number;
    height: number;
  }> {
    const apiKey = this.config.get<string>("gemini.apiKey") || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured for Imagen 3 generation");
    }

    this.logger.log(`Requesting Google Imagen 3 visual for: "${prompt.slice(0, 80)}..."`);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          outputMimeType: "image/jpeg",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Imagen 3 API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Data) {
      throw new Error("Google Imagen 3 returned empty image payload");
    }

    const filename = draftId ? `${draftId}-gemini.jpg` : `gemini_${Date.now()}.jpg`;
    const localPath = path.join(this.imagesDir, filename);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(localPath, buffer);

    this.logger.log(`Google Imagen 3 visual saved to ${localPath}`);

    return {
      url: `/data/images/${filename}`,
      localPath,
      prompt,
      width: 1200,
      height: 675,
    };
  }
}
