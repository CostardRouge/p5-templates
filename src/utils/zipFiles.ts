import path from "path";
import * as tar from "tar";

async function zipFiles(
  files: string[], outputZipPath: string
) {
  await tar.c(
    {
      gzip: true,
      file: outputZipPath,
      cwd: path.dirname( files[ 0 ] ),
    },
    files.map( file => path.basename( file ) )
  );
}

export default zipFiles;