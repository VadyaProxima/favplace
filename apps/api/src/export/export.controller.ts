import { Controller, Post, Body, Res, BadRequestException } from "@nestjs/common";
import { Response } from "express";
import { ExportService } from "./export.service";

@Controller("api/export")
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post("stl")
  async exportSTL(
    @Body() body: { heightMap: number[][]; ringRadius?: number; tubeRadius?: number; reliefHeight?: number; segments?: number },
    @Res() res: Response,
  ) {
    if (!body.heightMap || body.heightMap.length === 0) {
      throw new BadRequestException("heightMap is required");
    }

    const stl = this.exportService.generateSTL(body.heightMap, {
      ringRadius: body.ringRadius ?? 1,
      tubeRadius: body.tubeRadius ?? 0.15,
      reliefHeight: body.reliefHeight ?? 0.08,
      segments: body.segments ?? 256,
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment; filename=favplace-ring.stl");
    res.send(stl);
  }
}
