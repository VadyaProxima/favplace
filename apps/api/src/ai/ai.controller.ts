import { Controller, Post, Body } from "@nestjs/common";
import { AiService } from "./ai.service";

@Controller("api/ai")
export class AiController {
  constructor(private aiService: AiService) {}

  @Post("identify-place")
  async identifyPlace(@Body() body: { image: string }) {
    return this.aiService.identifyPlace(body.image);
  }
}
