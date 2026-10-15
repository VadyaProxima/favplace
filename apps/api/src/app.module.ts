import { Module } from '@nestjs/common'
import { AdminModule } from './admin/admin.module'
import { AiModule } from './ai/ai.module'
import { OrdersModule } from './orders/orders.module'
import { PrismaModule } from './prisma/prisma.module'
import { TerrainModule } from './terrain/terrain.module'

@Module({
	imports: [PrismaModule, TerrainModule, OrdersModule, AiModule, AdminModule],
})
export class AppModule {}
