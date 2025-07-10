// 章节类别常量
export const ARCHIVE_CHAPTERS = {
  BEN_JI: "本纪",
  SHI_JIA: "世家",
  SOU_SHEN: "搜神",
  LIE_ZHUAN: "列传",
  YOU_XIA: "游侠",
  QUN_XIANG: "群像",
  SUI_YUAN_SHI_DAN: "随园食单",
} as const

// 章节类别键名常量（便于在代码中直接使用）
export const CHAPTER_KEYS = {
  BEN_JI: "BEN_JI",
  SHI_JIA: "SHI_JIA",
  SOU_SHEN: "SOU_SHEN",
  LIE_ZHUAN: "LIE_ZHUAN",
  YOU_XIA: "YOU_XIA",
  QUN_XIANG: "QUN_XIANG",
  SUI_YUAN_SHI_DAN: "SUI_YUAN_SHI_DAN",
} as const

export type ArchiveChapter =
  (typeof ARCHIVE_CHAPTERS)[keyof typeof ARCHIVE_CHAPTERS]

// 章节类别的英文键名
export type ArchiveChapterKey = keyof typeof ARCHIVE_CHAPTERS

/**
 * 获取所有有效的章节类别
 */
export function getValidChapters(): string[] {
  return Object.values(ARCHIVE_CHAPTERS)
}

/**
 * 验证章节类别是否有效
 */
export function isValidChapter(chapter: string): chapter is ArchiveChapter {
  return Object.values(ARCHIVE_CHAPTERS).includes(chapter as ArchiveChapter)
}

// 使用示例：
// 1. 使用英文键名获取中文名称：getChapterByKey(CHAPTER_KEYS.BEN_JI) => "本纪"
// 2. 使用中文名称获取英文键名：getKeyByChapter("本纪") => "BEN_JI"
// 3. 验证章节有效性：isValidChapter("本纪") => true
// 4. 获取所有有效章节：getValidChapters() => ["本纪", "世家", ...]

/**
 * 根据英文键名获取中文章节名称
 */
export function getChapterByKey(key: ArchiveChapterKey): string {
  return ARCHIVE_CHAPTERS[key]
}

/**
 * 根据中文章节名称获取英文键名
 */
export function getKeyByChapter(chapter: string): ArchiveChapterKey | null {
  for (const [key, value] of Object.entries(ARCHIVE_CHAPTERS)) {
    if (value === chapter) {
      return key as ArchiveChapterKey
    }
  }
  return null
}
