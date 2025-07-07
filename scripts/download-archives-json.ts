import fs from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const ARCHIVES_JSON_URL = process.env.ARCHIVES_JSON_URL

export interface ArchivesJson {
  archives: Record<
    string,
    {
      id: string
      title: string
      author: string[]
      publisher: string
      date: string
      chapter: string
      tag: string[]
      remarks: string
      origs: string[]
      likes: number
    }
  >
  fieldFreqMap: {
    author: Record<string, number>
    publisher: Record<string, number>
    date: Record<string, number>
    tag: Record<string, number>
  }
}

async function downloadArchivesJson(url: string) {
  const data = (await axios.get<ArchivesJson>(url)).data
  const targetPath = resolve(__dirname, "../data/archives.json")
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2), "utf-8")
}

if (!ARCHIVES_JSON_URL) {
  console.error("ARCHIVES_JSON_URL is not set in .env file")
  process.exit(1)
}

downloadArchivesJson(ARCHIVES_JSON_URL)
