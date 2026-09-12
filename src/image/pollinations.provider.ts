import { Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildEditorialBrandPrompt } from "./huggingface.provider";

@Injectable()
export class PollinationsProvider {
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor() {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  styleDeveloperPrompt(rawPrompt: string): string {
    const cleaned = (rawPrompt || "").trim() || "Modern high-performance technology architecture";
    if (cleaned.length > 80 && /photography|cinematic|detailed|macro|render/i.test(cleaned)) {
      return `${cleaned}, 8k resolution, crisp focus, no text, no watermark, no logos`;
    }
    return `${cleaned}, professional editorial photography, striking composition, natural cinematic lighting, highly detailed, 8k resolution, crisp focus, photorealistic, no text, no watermark, no logos`;
  }

  getDirectUrl(prompt: string, width = 1200, height = 627): string {
    const styled = this.styleDeveloperPrompt(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
  }

  async generateAndSave(prompt: string, draftId?: string, width = 1200, height = 627): Promise<{
    url: string;
    localPath: string;
    prompt: string;
    width: number;
    height: number;
  }> {
    const styled = this.styleDeveloperPrompt(prompt);
    const url = this.getDirectUrl(styled, width, height);
    const filename = draftId ? `${draftId}.jpg` : `img_${Date.now()}.jpg`;
    const localPath = path.join(this.imagesDir, filename);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Pollinations image fetch failed (${res.status}): ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localPath, buffer);

    return {
      url,
      localPath,
      prompt: styled,
      width,
      height,
    };
  }
}

