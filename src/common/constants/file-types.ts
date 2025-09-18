// 支持的文件类型常量
export const SUPPORTED_MIME_TYPES = [
  "text/html",
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const

export const SUPPORTED_FILE_EXTENSIONS = [
  ".html",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
] as const

export const MAX_FILE_SIZE = 1024 * 1024 * 100 // 100 MB

// 类型定义
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]
export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number]
