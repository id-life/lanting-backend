import { Buffer } from "node:buffer"
import { extname } from "node:path"
import { BadRequestException } from "@nestjs/common"
import { MulterModuleOptions } from "@nestjs/platform-express"
import * as iconv from "iconv-lite"
import {
  MAX_FILE_SIZE,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
} from "@/common/constants/file-types"

export const multerConfig: MulterModuleOptions = {
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    file.originalname = decodeFileName(file.originalname)
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true)
    } else {
      const ext = extname(file.originalname).toLowerCase()
      if (SUPPORTED_FILE_EXTENSIONS.includes(ext as any)) {
        cb(null, true)
      } else {
        cb(new BadRequestException(["Invalid file type"]), false)
      }
    }
  },
}

/**
 * 解码文件名，处理各种编码问题
 */
function decodeFileName(filename: string): string {
  try {
    // 方法1: 处理URL编码
    if (filename.includes("%")) {
      try {
        return decodeURIComponent(filename)
      } catch (e) {
        console.warn("URL decode failed:", e)
      }
    }

    // 方法2: 处理ISO-8859-1到UTF-8的转换（常见的浏览器上传编码问题）
    if (isLatin1Encoded(filename)) {
      const buffer = Buffer.from(filename, "latin1")
      return iconv.decode(buffer, "utf8")
    }

    // 方法3: 尝试GB2312/GBK编码（中文系统常见）
    if (hasChineseGarbled(filename)) {
      try {
        const buffer = Buffer.from(filename, "latin1")
        return iconv.decode(buffer, "gb2312")
      } catch (e) {
        console.warn("GB2312 decode failed:", e)
      }
    }

    return filename
  } catch (error) {
    console.error("File name decode error:", error)
    return `file_${Date.now()}`
  }
}

/**
 * 检查是否是Latin1编码的UTF-8字符
 */
function isLatin1Encoded(str: string): boolean {
  try {
    const buffer = Buffer.from(str, "latin1")
    const decoded = iconv.decode(buffer, "utf8")
    return decoded !== str && /[\u4E00-\u9FFF]/.test(decoded)
  } catch {
    return false
  }
}

/**
 * 检查是否包含中文乱码特征
 */
function hasChineseGarbled(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false
  }

  try {
    // 检查是否包含连续的高位ASCII字符
    const hasConsecutiveHighAscii = /[\x80-\xFF]{2,}/.test(str)

    // 检查常见的中文乱码模式
    const hasCommonGarbledPatterns = [
      // eslint-disable-next-line regexp/no-obscure-range
      /[À-ÿ]{2,}/, // 连续的拉丁扩展字符
      /Â[€£¥§©®°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/, // 修复字符范围问题
      /[\xC0-\xDF][\x80-\xBF]/, // UTF-8双字节字符被误解析
      /[\xE0-\xEF][\x80-\xBF]{2}/, // UTF-8三字节字符被误解析
    ].some((pattern) => pattern.test(str))

    // 检查是否不包含正常字符但包含可疑字符
    const hasNoNormalChars = !/[\w\u4E00-\u9FFF\s.-]/.test(str)
    const hasSuspiciousChars = /[\x80-\xFF]/.test(str)

    const result =
      hasConsecutiveHighAscii ||
      hasCommonGarbledPatterns ||
      (hasNoNormalChars && hasSuspiciousChars)

    if (result) {
      console.log("Detected garbled Chinese characters in:", str)
    }

    return result
  } catch (error) {
    console.error("Error checking for garbled characters:", error)
    return false
  }
}
