import path from "path";
import os from "node:os";

import downloadFileResponse from "@/utils/downloadFileResponse";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
        return new Response("Missing file name", { status: 400 });
    }

    return downloadFileResponse(path.join(os.tmpdir(), name));
}