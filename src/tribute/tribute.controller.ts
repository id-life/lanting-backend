import { Controller, Get, Param, Post, Query } from "@nestjs/common"
import { TributeService } from "./tribute.service"

@Controller("tribute")
export class TributeController {
  constructor(private readonly tributeService: TributeService) {}

  @Get("info")
  getInfo(@Query("link") link: string) {
    return this.tributeService.getInfo(link)
  }

  @Get("all")
  getAll() {
    return this.tributeService.getAll()
  }

  @Get("content/:filename")
  getContent(@Param("filename") filename: string) {
    return this.tributeService.getContent(filename)
  }

  @Post("extract-html")
  extractHtml() {
    return this.tributeService.extractHtml()
  }
}
