import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { join } from "path";

export function ResolveDataDir(): string {
  loadEnv({ override: false });
  const envDir = process.env.DATA_DIR?.trim();
  const dataDir =
    envDir && envDir.length > 0 ? envDir : join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}
