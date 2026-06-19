cat > app/lib/price-feed.ts << 'EOF'
export type CurrencyPair = 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'AUDUSD' | 'USDCAD';

export const PAIRS: CurrencyPair[] = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];

const FALLBACK_BASE: Record<CurrencyPair, number> = {
  EURUSD: 1.08920,
  GBPUSD: 1.27150,
  USDJPY: 157.850,
  AUDUSD: 0.66450,
  USDCAD: 1.37150,
};

interface PriceCache {
  prices: Record<CurrencyPair, number>;
  fetchedAt: number;
  source: 'live' | 'simulated';
}

let cache: PriceCache | null = null;
const CACHE_TTL_MS = 50000;

function decimalsFor(pair: CurrencyPair): number {
  return pair === 'USDJPY' ? 3 : 5;
}

function simulateAround(base: Record<CurrencyPair, number>): Record<CurrencyPair, number> {
  const out = {} as Record<CurrencyPair, number>;
  for (const pair of PAIRS) {
    const pipSize = pair === 'USDJPY' ? 0.01 : 0.0001;
    const next = base[pair] + (Math.random() - 0.5) * pipSize * 6;
    out[pair] = Number(next.toFixed(decimalsFor(pair)));
  }
  return out;
}

async function fetchFromCurrencyFreaks(apiKey: string): Promise<Record<CurrencyPair, number>> {
  const res = await fetch('https://api.currencyfreaks.com/latest?apikey=' + apiKey, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error('CurrencyFreaks returned ' + res.status);

  const data = await res.json();
  const rates = data.rates as Record<string, string>;

  const eur = parseFloat(rates.EUR);
  const gbp = parseFloat(rates.GBP);
  const jpy = parseFloat(rates.JPY);
  const aud = parseFloat(rates.AUD);
  const cad = parseFloat(rates.CAD);

  if (![eur, gbp, jpy, aud, cad].every(Number.isFinite)) {
    throw new Error('Incomplete rate data from CurrencyFreaks');
  }

  return {
    EURUSD: Number((1 / eur).toFixed(5)),
    GBPUSD: Number((1 / gbp).toFixed(5)),
    USDJPY: Number(jpy.toFixed(3)),
    AUDUSD: Number((1 / aud).toFixed(5)),
    USDCAD: Number(cad.toFixed(5)),
  };
}

export async function getLivePrices(): Promise<{
  prices: Record<CurrencyPair, number>;
  source: 'live' | 'simulated';
  updatedAt: number;
}> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { prices: cache.prices, source: cache.source, updatedAt: cache.fetchedAt };
  }

  const apiKey = process.env.CURRENCYFREAKS_API_KEY;

  if (apiKey) {
    try {
      const prices = await fetchFromCurrencyFreaks(apiKey);
      cache = { prices, fetchedAt: now, source: 'live' };
      return { prices, source: 'live', updatedAt: now };
    } catch (err) {
      console.error('Live price fetch failed, falling back to simulated:', err instanceof Error ? err.message : err);
    }
  }

  const base = cache?.prices ?? FALLBACK_BASE;
  const prices = simulateAround(base);
  cache = { prices, fetchedAt: now, source: 'simulated' };
  return { prices, source: 'simulated', updatedAt: now };
}

const DISPLAY_MAP: Record<CurrencyPair, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD',
};

export function pairToDisplay(pair: CurrencyPair): string {
  return DISPLAY_MAP[pair];
}

export function displayToPair(display: string): CurrencyPair {
  return display.replace('/', '') as CurrencyPair;
}
EOF
