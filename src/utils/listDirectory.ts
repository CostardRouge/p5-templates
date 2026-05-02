import {
  readdir
} from "fs/promises";
import path from "path";

async function listDirectory( directoryPath: string ) {
  try {
    const absolutePath = path.resolve(
      process.cwd(),
      directoryPath
    );

    return await readdir( absolutePath );
  } catch ( error ) {
    console.error(
      `Error reading directory "${ directoryPath }":`,
      error
    );
    return [
    ];
  }
}

export default listDirectory;
