import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Builds prompt following user's exact 7-layer editorial branding rules:
 * 1 | <metaphor> — the writer's own visual idea, always first
 * 2 | striking, modern, editorial tech illustration
 * 3 | visually creative and attention-grabbing, one clear focal subject
 * 4 | premium quality, highly detailed, cinematic lighting, depth of field
 * 5 | deep dark background, strong contrast so white text remains legible
 * 6 | teal and turquoise as the brand accent colour, supported by white, soft grey and charcoal
 * 7 | no text, no letters, no words, no watermark, no logos
 */
export function buildEditorialBrandPrompt(rawPrompt: string): string {
  const metaphor = (rawPrompt || "").trim() || "modern technology concepts and digital infrastructure architecture";
  return [
    metaphor,
    "striking, modern, editorial tech illustration",
    "visually creative and attention-grabbing, one clear focal subject",
    "premium quality, highly detailed, cinematic lighting, depth of field",
    "deep dark background, strong contrast so white text remains legible",
    "teal and turquoise as the brand accent colour, supported by white, soft grey and charcoal, palette adapted with vibrant teal accent present",
    "no text, no letters, no words, no watermark, no logos",
  ].join(", ");
}

@Injectable()
export class HuggingFaceProvider {
  private readonly logger = new Logger(HuggingFaceProvider.name);
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor(private readonly config: ConfigService) {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  isConfigured(): boolean {
    const token = this.config.get<string>("huggingface.token") || process.env.HUGGINGFACE_TOKEN;
    return Boolean(token && token.trim().length > 0);
  }

  async generateAndSave(
    prompt: string,
    draftId?: string,
    width = 1200,
    height = 627
  ): Promise<{
    url: string;
    localPath: string;
    prompt: string;
    width: number;
    height: number;
  }> {
    const token = this.config.get<string>("huggingface.token") || process.env.HUGGINGFACE_TOKEN;
    if (!token) {
      throw new Error("HUGGINGFACE_TOKEN not configured");
    }

    const model =
      this.config.get<string>("huggingface.model") ||
      process.env.HUGGINGFACE_MODEL ||
      "black-forest-labs/FLUX.1-dev";

    const styledPrompt = buildEditorialBrandPrompt(prompt);
    this.logger.log(`Requesting HuggingFace image with model ${model}...`);

    const apiUrl = `https://api-inference.huggingface.co/models/${model}`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: styledPrompt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HuggingFace API error (${res.status}): ${errText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      if (json.error) {
        throw new Error(`HuggingFace returned error: ${json.error}`);
      }
    }

    const filename = draftId ? `${draftId}-hf.jpg` : `hf_${Date.now()}.jpg`;
    const localPath = path.join(this.imagesDir, filename);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localPath, buffer);

    this.logger.log(`HuggingFace image saved to ${localPath}`);

    return {
      url: `/data/images/${filename}`,
      localPath,
      prompt: styledPrompt,
      width,
      height,
    };
  }
}

