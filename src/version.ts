import fs from "node:fs";

interface PackageJson {
  version?: string;
}

export function getPackageVersion(): string {
  try {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonUrl, "utf-8")
    ) as PackageJson;

    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}