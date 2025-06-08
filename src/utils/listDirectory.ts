import {
  readdir
} from "fs/promises";

async function listDirectory( directoryPath: string ) {
  try {
    return await readdir( directoryPath );
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