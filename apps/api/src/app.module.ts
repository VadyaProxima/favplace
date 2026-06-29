import { Module } from '@nestjs/common'
import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { ExportModule } from './export/export.module'
import { OrdersModule } from './orders/orders.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProjectsModule } from './projects/projects.module'
import { TerrainModule } from './terrain/terrain.module'

@Module({
	imports: [
		PrismaModule,
		AuthModule,
		TerrainModule,
		ProjectsModule,
		OrdersModule,
		AiModule,
		ExportModule,
	],
})
export class AppModule {}
