import { ArchiveOrig } from "../entities/archive-orig.entity"
import { Archive } from "../entities/archive.entity"
import { Author } from "../entities/author.entity"
import { Comment } from "../entities/comment.entity"

/**
 * 包含所有关联数据的档案类型
 * 用于 transformArchiveData 方法的参数类型
 *
 * 注意：这些字段的结构反映了 Prisma 关联查询的真实返回结构，
 * 因为它们通过中间表进行关联，所以包含了嵌套的字段结构。
 */
export interface ArchiveWithRelations
  extends Omit<Archive, "authors" | "publisher" | "date" | "tags" | "origs"> {
  // ArchiveAuthor[] with included Author
  authors?: Array<{
    author: Author
    order: number
  }>
  // ArchivePublisher with included Publisher (single relation)
  publisher?: {
    publisher: {
      id: number
      name: string
    }
  } | null
  // ArchiveDate with included Date (single relation)
  date?: {
    date: {
      id: number
      value: string
    }
  } | null
  // ArchiveTag[] with included Tag
  tags?: Array<{
    tag: {
      id: number
      name: string
    }
  }>
  // Direct relation, no intermediate table
  origs?: Array<ArchiveOrig>
  comments?: Array<Comment>
}
