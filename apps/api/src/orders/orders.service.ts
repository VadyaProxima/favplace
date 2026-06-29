import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { project: true } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }

  async create(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.userId !== userId) throw new ForbiddenException();

    const existing = await this.prisma.order.findUnique({ where: { projectId } });
    if (existing) throw new BadRequestException("Order already exists for this project");

    return this.prisma.order.create({
      data: { userId, projectId, status: "pending", totalPrice: 0 },
      include: { project: true },
    });
  }

  async updateStatus(id: string, userId: string, status: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) throw new ForbiddenException();

    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
