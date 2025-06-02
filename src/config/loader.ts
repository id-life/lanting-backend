import process from "node:process"
import { registerAs } from "@nestjs/config"
import { AppConfig, appConfigSchema } from "./schema"

export const configLoader = registerAs("app", (): AppConfig => {
  const parsedConfig = appConfigSchema.parse(process.env)
  return parsedConfig
})
