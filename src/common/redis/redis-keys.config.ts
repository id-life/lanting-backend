/**
 * Redis Keys Configuration
 * Centralized configuration for all Redis cache keys used in the application
 */
export class RedisKeys {
  private static readonly PREFIX = "lanting-bio"

  // Archive related keys
  static archive(id: number): string {
    return `${this.PREFIX}:archives:v3:${id}`
  }

  static archiveWithComments(id: number): string {
    return `${this.PREFIX}:archives:v3:${id}:with-comments`
  }

  static archivesAll(): string {
    return `${this.PREFIX}:archives:v3:all`
  }

  static archiveComments(archiveId: number): string {
    return `${this.PREFIX}:archive_comments:${archiveId}`
  }

  static archiveContent(archiveFilename: string): string {
    return `${this.PREFIX}:archive_content:${archiveFilename}`
  }

  // Search keywords related keys
  static searchKeywordsAll(): string {
    return `${this.PREFIX}:search_keywords:all`
  }

  // Tribute related keys
  static tributeInfo(normalizedUrl: string): string {
    const sanitizedUrl = normalizedUrl.replace(/\W/g, "_")
    return `${this.PREFIX}:tribute_info:${sanitizedUrl}`
  }

  static tributeExtract(contentHash: string): string {
    return `${this.PREFIX}:tribute_extract:${contentHash}`
  }
}
