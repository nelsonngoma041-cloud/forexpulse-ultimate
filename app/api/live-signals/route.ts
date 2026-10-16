// app/api/live-signals/route.ts
// The bot now runs on the Render bridge (always on).
// This route only passes dashboard buttons through to it.

import { NextResponse } from 'next/server';

function getBridge() {
  const url = process.env.RAILWAY_BRIDGE_URL;
  const secret = process.env.RAILWAY_BRIDGE_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

async function bridge(payload: Record<string, unknown>) {
  const cfg = getBridge();
  if (!cfg) throw new Error('Bridge not configured');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-secret': cfg.secret },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000), // Render free tier can take ~30s to wake
    cache: 'no-store',
  });
  return (await res.json()) as Record<string, unknown>;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await bridge({ cmd: 'BOT_STATUS' });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({
      running: false,
      signalCount: 0,
      dailyWins: 0,
      dailyLosses: 0,
      mt5Connected: false,
      derivConnected: false,
      recentSignals: [],
      message: 'Bridge unreachable: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
}

export async function POST(request: Request) {
  let body: { action?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const map: Record<string, string> = {
    start: 'BOT_START',
    stop: 'BOT_STOP',
    test: 'BOT_TEST',
  };
  const cmd = body.action ? map[body.action] : undefined;
  if (!cmd) return NextResponse.json({ error: 'Unknown action: ' + body.action }, { status: 400 });

  try {
    const data = await bridge({ cmd });
    return NextResponse.json({ ...data, success: data.success ?? data.ok });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: 'Bridge unreachable: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
}
