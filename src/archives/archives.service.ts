import { Injectable, NotFoundException } from "@nestjs/common"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

// TODO: Delete
// This is a mock data source for demonstration purposes.
const archives = [
  {
    id: 1,
    title: "三国志",
    author: "陈寿",
    date: "280 CE",
    content: "蜀书·先主传",
  },
  {
    id: 2,
    title: "史记",
    author: "司马迁",
    date: "94 BCE",
    content: "货殖列传",
  },
  {
    id: 3,
    title: "资治通鉴",
    author: "司马光",
    date: "1084 CE",
    content: "唐纪",
  },
]
@Injectable()
export class ArchivesService {
  create(_createArchiveDto: CreateArchiveDto) {
    return "This action adds a new archive"
  }

  findAll() {
    return {
      success: true,
      count: archives.length,
      data: archives,
    }
  }

  findOne(id: number) {
    const archive = archives.find((archive) => archive.id === id)

    if (!archive) {
      throw new NotFoundException({
        success: false,
        data: null,
      })
    }

    return {
      success: true,
      data: archive,
    }
  }

  update(id: number, _updateArchiveDto: UpdateArchiveDto) {
    return `This action updates a #${id} archive`
  }

  remove(id: number) {
    return `This action removes a #${id} archive`
  }
}
