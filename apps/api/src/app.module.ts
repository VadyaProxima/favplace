import { Module } from "@nestjs/common";
import { TerrainModule } from "./terrain/terrain.module";

@Module({
  imports: [TerrainModule],
})
export class AppModule {}
