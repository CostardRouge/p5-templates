import { NextRequest } from 'next/server';
import { getProgress, hasJob } from '@/lib/progressStore';

/**
 * EventSource endpoint.
 * GET /api/record-progress?id=<jobId>
 */
export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id');
    if (!id || !hasJob(id)) {
        return new Response('unknown jobId', { status: 404 });
    }

    let intervalId = undefined;

    const stream = new ReadableStream({
        start(controller) {
            const sendUpdate = () => {
                const progress = getProgress(id);

                if (!progress) {
                    clearInterval(intervalId);
                    controller.close();
                    return;
                }

                controller.enqueue(`data: ${JSON.stringify(progress)}\n\n`);

                if (progress.step === 'done' || progress.step === 'error') {
                    clearInterval(intervalId);
                    controller.close();
                }
            };

            const intervalId = setInterval(sendUpdate, 500);
            sendUpdate();
        },
        cancel() {
            clearInterval(intervalId);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}