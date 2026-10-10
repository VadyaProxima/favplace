import { Controller, Get, Query, Res, StreamableFile } from "@nestjs/common";
import type { Response } from 'express';
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
	@Query("format") format?: string,
	@Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.terrainService.getHeightMap(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      resolution ? parseInt(resolution) : 64,
	  bearing ? parseFloat(bearing) : 0,
	  zoomOffset ? parseInt(zoomOffset) : 0,
    );
	if (format !== 'f32') return result;
	// Float32 keeps more precision than the DEM while avoiding a ~20 MB JSON grid.
	const buffer = Buffer.allocUnsafe(result.width * result.height * 4);
	let offset = 0;
	for (const row of result.data) for (const value of row) {
		buffer.writeFloatLE(value, offset);
		offset += 4;
	}
	response?.setHeader('X-Terrain-Metadata', JSON.stringify({
		width: result.width,
		height: result.height,
		metadata: result.metadata,
		frame: result.frame,
	}));
	return new StreamableFile(buffer, { type: 'application/octet-stream', length: buffer.length });
  }
}
