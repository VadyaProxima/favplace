import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }

  async create(userId: string, data: { name: string; locationJson: string; ringConfigJson: string; heightMapJson?: string }) {
    return this.prisma.project.create({
      data: { userId, ...data },
    });
  }

  async update(id: string, userId: string, data: { name?: string; locationJson?: string; ringConfigJson?: string; heightMapJson?: string }) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.delete({ where: { id } });
  }
}
