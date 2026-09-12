import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from "@nestjs/common";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any) {
    try {
      await this.telegramService.handleUpdate(update);
    } catch (err: any) {
      this.logger.error(`Error processing Telegram webhook update: ${err.message}`);
    }
    return "OK";
  }
}

