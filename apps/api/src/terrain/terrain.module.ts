import { Module } from "@nestjs/common";
import { TerrainController } from "./terrain.controller";
import { TerrainService } from "./terrain.service";

@Module({
  controllers: [TerrainController],
  providers: [TerrainService],
})
export class TerrainModule {}
