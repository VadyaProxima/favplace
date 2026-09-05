import { Controller, Get, Query } from "@nestjs/common";
import { TerrainService } from "./terrain.service";

@Controller("api/terrain")
export class TerrainController {
  constructor(private readonly terrainService: TerrainService) {}

  @Get("heightmap")
  async getHeightMap(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("radius") radius: string,
    @Query("resolution") resolution?: string,
	@Query("bearing") bearing?: string,
	@Query("zoomOffset") zoomOffset?: string,
  ) {
    return this.terrainService.getHeightMap(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      resolution ? parseInt(resolution) : 64,
	  bearing ? parseFloat(bearing) : 0,
	  zoomOffset ? parseInt(zoomOffset) : 0,
    );
  }
}
