import { Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class PollinationsProvider {
  private readonly imagesDir = path.resolve(process.cwd(), "data/images");

  constructor() {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  styleDeveloperPrompt(rawPrompt: string): string {
    const cleaned = (rawPrompt || "").trim();
    if (!cleaned) {
      return "Professional modern software engineering workspace, ultrawide monitor displaying clean code, warm ambient office lighting, cinematic composition, photorealistic, 8k";
    }

    if (cleaned.length > 80) {
      return `${cleaned}, professional photography, high resolution, subtle tech aesthetic, cinematic lighting, crisp focus, no distorted text`;
    }

    return `Modern software engineering visual: ${cleaned}. Sleek developer workspace, dual monitors, subtle architecture diagrams and clean UI elements, cinematic depth of field, warm ambient lighting, highly detailed, photorealistic, no distorted text`;
  }

  getDirectUrl(prompt: string, width = 1200, height = 627): string {
    const styled = this.styleDeveloperPrompt(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;
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

