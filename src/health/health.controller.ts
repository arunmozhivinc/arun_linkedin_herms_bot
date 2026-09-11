import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get("keepalive")
  getKeepalive() {
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
    };
  }
}

