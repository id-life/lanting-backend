import {
  getChapterByKey,
  getKeyByChapter,
  getValidChapters,
  isValidChapter,
} from "./archive-chapters"

describe("archive chapters", () => {
  describe("getValidChapters", () => {
    it("should return all valid chapters", () => {
      const chapters = getValidChapters()
      expect(chapters).toEqual([
        "本纪",
        "世家",
        "搜神",
        "列传",
        "游侠",
        "群像",
        "随园食单",
      ])
    })
  })

  describe("isValidChapter", () => {
    it("should return true for valid chapters", () => {
      expect(isValidChapter("本纪")).toBe(true)
      expect(isValidChapter("世家")).toBe(true)
      expect(isValidChapter("搜神")).toBe(true)
    })

    it("should return false for invalid chapters", () => {
      expect(isValidChapter("invalid")).toBe(false)
      expect(isValidChapter("")).toBe(false)
    })
  })

  describe("getChapterByKey", () => {
    it("should return correct Chinese chapter name for English key", () => {
      expect(getChapterByKey("BEN_JI")).toBe("本纪")
      expect(getChapterByKey("SHI_JIA")).toBe("世家")
      expect(getChapterByKey("SOU_SHEN")).toBe("搜神")
    })
  })

  describe("getKeyByChapter", () => {
    it("should return correct English key for Chinese chapter name", () => {
      expect(getKeyByChapter("本纪")).toBe("BEN_JI")
      expect(getKeyByChapter("世家")).toBe("SHI_JIA")
      expect(getKeyByChapter("搜神")).toBe("SOU_SHEN")
    })

    it("should return null for invalid chapter name", () => {
      expect(getKeyByChapter("invalid")).toBe(null)
      expect(getKeyByChapter("")).toBe(null)
    })
  })
})
