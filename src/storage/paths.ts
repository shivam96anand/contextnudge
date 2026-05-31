import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function getDataDir(): string {
  const dir = path.join(os.homedir(), ".contextnudge");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDbPath(): string {
  return path.join(getDataDir(), "contextnudge.sqlite");
}

export function getLogDir(): string {
  const dir = path.join(getDataDir(), "logs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
