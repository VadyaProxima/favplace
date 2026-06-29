import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.projectsService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req: any) {
    return this.projectsService.findOne(id, req.user.id);
  }

  @Post()
  create(@Request() req: any, @Body() body: { name: string; locationJson: string; ringConfigJson: string; heightMapJson?: string }) {
    return this.projectsService.create(req.user.id, body);
  }

  @Put(":id")
  update(@Param("id") id: string, @Request() req: any, @Body() body: { name?: string; locationJson?: string; ringConfigJson?: string; heightMapJson?: string }) {
    return this.projectsService.update(id, req.user.id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req: any) {
    return this.projectsService.remove(id, req.user.id);
  }
}
