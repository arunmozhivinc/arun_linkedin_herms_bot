import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, "../../data/images");

/**
 * Ensures the data/images directory exists.
 */
function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

/**
 * Enhances a raw topic/idea prompt into a clean, professional software engineering aesthetic.
 */
export function styleDeveloperPrompt(rawPrompt) {
  const cleaned = (rawPrompt || "").trim();
  if (!cleaned) {
    return "Professional modern software engineering workspace, ultrawide monitor displaying clean code, warm ambient office lighting, cinematic composition, photorealistic, 8k";
  }

  // If the user already provided a detailed prompt, keep it but add quality stylers
  if (cleaned.length > 80) {
    return `${cleaned}, professional photography, high resolution, subtle tech aesthetic, cinematic lighting, crisp focus, no distorted text`;
  }

  return `Modern software engineering aesthetic: ${cleaned}. Sleek developer workspace, dual monitors, subtle architecture diagrams and clean UI elements, cinematic depth of field, warm ambient lighting, highly detailed, photorealistic, no distorted text`;
}

/**
 * Generates the direct Pollinations.ai image URL for instant previews.
 */
export function getPollinationsUrl(prompt, { width = 1200, height = 627, seed } = {}) {
  const styled = styleDeveloperPrompt(prompt);
  const encoded = encodeURIComponent(styled);
  const seedParam = seed ? `&seed=${seed}` : `&seed=${Math.floor(Math.random() * 1000000)}`;
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true${seedParam}`;
}

/**
 * Fetches the image from Pollinations.ai and saves it locally for LinkedIn REST media upload.
 */
export function fetchAndSavePollinationsImage(prompt, { draftId, filename, width = 1200, height = 627 } = {}) {
  ensureImagesDir();
  const styledPrompt = styleDeveloperPrompt(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

  const targetFilename = filename || (draftId ? `${draftId}.jpg` : `img_${Date.now()}.jpg`);
  const localPath = path.join(IMAGES_DIR, targetFilename);

  return fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Pollinations image fetch failed (${res.status}): ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(localPath, buffer);

      return {
        url,
        localPath,
        filename: targetFilename,
        sizeBytes: buffer.length,
        prompt: styledPrompt,
        width,
        height,
      };
    });
}

