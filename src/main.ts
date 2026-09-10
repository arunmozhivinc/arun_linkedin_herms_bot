import "dotenv/config";
import * as dns from "node:dns";

// Ensure robust SRV record resolution for MongoDB Atlas across all operating systems & ISPs
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as path from "node:path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>("port") || 3000;
  const baseUrl = config.get<string>("baseUrl");

  // Serve generated images statically
  app.useStaticAssets(path.resolve(process.cwd(), "data/images"), {
    prefix: "/images/",
  });

  await app.listen(port);

  console.log("=========================================================");
  console.log(`🚀 LinkedIn Hermes Enterprise Platform running at: ${baseUrl}`);
  console.log(`📋 Web Drafts & Approval Dashboard:               ${baseUrl}/drafts`);
  console.log(`🔑 Master LinkedIn OAuth Login:                    ${baseUrl}/auth/linkedin`);
  console.log("=========================================================");
}

bootstrap();
