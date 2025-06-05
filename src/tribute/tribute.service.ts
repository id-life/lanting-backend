import { Injectable } from "@nestjs/common"

@Injectable()
export class TributeService {
  getInfo() {
    return `This is GET /tribute/info endpoint`
  }

  getAll() {
    return `This is GET /tribute/all endpoint`
  }

  getContent(filename: string) {
    return `This is GET /tribute/content/${filename} endpoint`
  }

  extractHtml() {
    return `This is POST /tribute/extract-html endpoint`
  }
}
