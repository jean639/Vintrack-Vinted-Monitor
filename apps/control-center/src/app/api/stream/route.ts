import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const userMonitors = await db.monitors.findMany({
    where: { userId: session.user.id },
    select: { id: true, query: true },
  });
  const monitorIds = new Set(userMonitors.map(m => m.id));
  const monitorNames = new Map(userMonitors.map((monitor) => [monitor.id, monitor.query]));

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  req.signal.addEventListener('abort', () => {
    redis.quit();
    writer.close();
  });

  redis.subscribe('vinted:new_items', (err) => {
    if (err) console.error('Redis subscribe error:', err);
  });

  redis.on('message', (channel, message) => {
    if (channel === 'vinted:new_items') {
      try {
        const parsed = JSON.parse(message);
        const monitorId = Number(parsed.monitor_id);

        if (Number.isInteger(monitorId) && monitorIds.has(monitorId)) {
          const enrichedPayload = JSON.stringify({
            ...parsed,
            monitor_id: monitorId,
            monitor_name: monitorNames.get(monitorId) || parsed.monitor_name || null,
          });
          const data = `data: ${enrichedPayload}\n\n`;
          writer.write(encoder.encode(data));
        }
      } catch {
        // Skip malformed messages
      }
    }
  });

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
