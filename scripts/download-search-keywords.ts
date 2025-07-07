import fs from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

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
