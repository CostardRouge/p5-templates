import fs from "node:fs/promises";

export default async function fileExists( filePath: string ) {
  try {
    await fs.stat( filePath );
    return true;
  } catch {
    return false;
  }
}
