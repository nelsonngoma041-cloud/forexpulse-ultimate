// app/api/prices/route.ts
import { NextResponse } from 'next/server';
import { getLivePrices } from '@/app/lib/price-feed';

export async function GET() {
  try {
    const { prices, source, updatedAt } = await getLivePrices();
    return NextResponse.json({ ok: true, prices, source, updatedAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
