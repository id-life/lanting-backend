import fs from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

/**
 * lanting.wiki 域名绑定到了新的 lanting 前端
 * 原本 api 的 URL 已经不再能使用，这个链接已经拿不到原本的 search keywords 数据了
 * 2025-7-14
 */
const SEARCH_KEYWORD_API_URL = process.env.SEARCH_KEYWORD_API_URL

export interface SearchKeywords {
  keywords: Record<string, number>
}

async function downloadSearchKeywords(url: string) {
  const data = (await axios.get<SearchKeywords>(url)).data
  const targetPath = resolve(__dirname, "../data/search-keywords.json")
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2), "utf-8")
}

if (!SEARCH_KEYWORD_API_URL) {
  console.error("SEARCH_KEYWORD_API_URL is not set in .env file")
  process.exit(1)
}

downloadSearchKeywords(SEARCH_KEYWORD_API_URL)
