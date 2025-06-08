import { ArchiveChapter } from "~/generated/prisma"

export class Archive {
  id: number
  title: string
  author: string | null
  publisher: string | null
  date: string | null
  chapter: ArchiveChapter | null
  tag: any | null // prisma JSON
  remarks: string | null
  originalUrl: string | null
  archiveFilename: string | null
  fileType: string | null
  createdAt: Date
  updatedAt: Date
}
