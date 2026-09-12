import { Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class PollinationsProvider {
  private readonly logger = new Logger(PollinationsProvider.name);
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor() {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  /**
   * Sanitizes and elevates prompt to award-winning editorial photographic quality.
   * Strips negative words from prompt body because modern diffusion models (FLUX/SD)
   * mistakenly render garbled text when words like "text", "letters", "watermark" are present.
   */
  styleDeveloperPrompt(rawPrompt: string): string {
    const cleaned = (rawPrompt || "").trim() || "Modern high-performance technology architecture";
    const sanitized = cleaned
      .replace(/no text,?/gi, "")
      .replace(/no words,?/gi, "")
      .replace(/no letters,?/gi, "")
      .replace(/no watermark,?/gi, "")
      .replace(/no logos?,?/gi, "")
      .replace(/white text remains legible,?/gi, "")
      .replace(/teal and turquoise as the brand accent colour,?/gi, "")
      .replace(/deep dark background,?/gi, "")
      .trim();

    if (/photography|candid|35mm|cinematic|detailed|hasselblad|leica|lens/i.test(sanitized)) {
      return `${sanitized}, 35mm photograph, natural cinematic lighting, rich depth of field, 8k resolution, crisp focus`;
    }
    return `${sanitized}, candid editorial photography, 35mm lens, natural ambient lighting, rich depth of field, sharp focus, 8k resolution`;
  }

  getDirectUrl(prompt: string, width = 1024, height = 680, model = "flux"): string {
    const styled = this.styleDeveloperPrompt(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const negativePrompt = "text,letters,words,watermark,logo,blurry,distorted,deformed,clipart,vector,cartoon";
    const params = new URLSearchParams({
      model,
      width: String(width),
      height: String(height),
      seed: String(seed),
      nologo: "true",
      negative_prompt: negativePrompt,
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?${params.toString()}`;
  }

  async generateAndSave(
    prompt: string,
    draftId?: string,
    width = 1024,
    height = 680
  ): Promise<{
    url: string;
    localPath: string;
    prompt: string;
    width: number;
    height: number;
  }> {
    const styled = this.styleDeveloperPrompt(prompt);
    const filename = draftId ? `${draftId}.jpg` : `img_${Date.now()}.jpg`;
    const localPath = path.join(this.imagesDir, filename);

    const primaryModel = process.env.POLLINATIONS_MODEL || "flux";
    const primaryUrl = this.getDirectUrl(styled, width, height, primaryModel);

    this.logger.log(`Requesting Pollinations image using model '${primaryModel}'...`);

    let res = await fetch(primaryUrl);

    // If primary model (e.g. flux) is busy or returns rate limit (429), smoothly fall back to turbo
    if (!res.ok && primaryModel !== "turbo") {
      this.logger.warn(`Pollinations ${primaryModel} returned status ${res.status}. Falling back to 'turbo'...`);
      const fallbackUrl = this.getDirectUrl(styled, width, height, "turbo");
      res = await fetch(fallbackUrl);
    }

    if (!res.ok) {
      throw new Error(`Pollinations image fetch failed (${res.status}): ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if Pollinations returned a JSON error payload instead of an image
    if (buffer.length < 2000) {
      const text = buffer.toString("utf8");
      if (text.includes("error") || text.includes("Too Many Requests")) {
        throw new Error(`Pollinations returned error payload: ${text.slice(0, 150)}`);
      }
    }

    fs.writeFileSync(localPath, buffer);
    this.logger.log(`Pollinations image saved successfully (${buffer.length} bytes) to ${localPath}`);

    return {
      url: `/data/images/${filename}`,
      localPath,
      prompt: styled,
      width,
      height,
    };
  }
}

