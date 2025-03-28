import { readdir } from 'fs/promises';

async function listDirectory(directoryPath: string ) {
    try {
        const files = await readdir(directoryPath);

        return files
    } catch (error) {
        console.error(`Error reading directory "${directoryPath}":`, error);
        return [];
    }
}

export default listDirectory;