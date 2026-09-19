import { NextRequest } from "next/server";
import { inboxEventEmitter, INBOX_EVENTS } from "@/lib/events/emitter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
      );

      // 2. Listener for incoming messages
      const onMessageReceived = (data: any) => {
        controller.enqueue(
          encoder.encode(`event: message\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 3. Listener for status receipt updates
      const onStatusUpdated = (data: any) => {
        controller.enqueue(
          encoder.encode(`event: status\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 4. Heartbeat keepalive every 25 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      inboxEventEmitter.on(INBOX_EVENTS.MESSAGE_RECEIVED, onMessageReceived);
      inboxEventEmitter.on(INBOX_EVENTS.MESSAGE_STATUS_UPDATED, onStatusUpdated);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        inboxEventEmitter.off(INBOX_EVENTS.MESSAGE_RECEIVED, onMessageReceived);
        inboxEventEmitter.off(INBOX_EVENTS.MESSAGE_STATUS_UPDATED, onStatusUpdated);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
