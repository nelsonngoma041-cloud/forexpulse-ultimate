"use client";

import { useEffect, useRef } from 'react';

export default function TradingViewChart({ 
  symbol = 'EURUSD', 
  interval = '60',
  theme = 'dark' 
}: { 
  symbol?: string; 
  interval?: string; 
  theme?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          container: containerRef.current,
          width: '100%',
          height: 450,
          symbol: `FX:${symbol}`,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1',
          locale: 'en',
          toolbar_bg: '#1a1a2e',
          enable_publishing: false,
          allow_symbol_change: true,
          studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies']
        });
      }
    };
    document.head.appendChild(script);
  }, [symbol, interval, theme]);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <div ref={containerRef} className="w-full h-[450px] rounded-lg overflow-hidden" />
    </div>
  );
}
