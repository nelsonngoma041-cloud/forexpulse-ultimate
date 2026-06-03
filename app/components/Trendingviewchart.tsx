// app/components/TradingViewChart.tsx
"use client";

import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  interval?: '1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W' | 'M';
  theme?: 'light' | 'dark';
}

export default function TradingViewChart({ 
  symbol = 'EURUSD', 
  interval = '60',
  theme = 'dark' 
}: TradingViewChartProps) {
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
          height: 500,
          symbol: `FX:${symbol}`,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1',
          locale: 'en',
          toolbar_bg: '#1a1a2e',
          enable_publishing: false,
          allow_symbol_change: true,
          details: true,
          hotlist: true,
          calendar: true,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'BollingerBands@tv-basicstudies'
          ]
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [symbol, interval, theme]);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div ref={containerRef} className="w-full h-[500px]" />
    </div>
  );
}
