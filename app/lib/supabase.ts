// app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nhzmllttypzzrebamrtd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_EvuajQDWdoJD-zT3wSEaPw_sebut9GH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TradeRecord {
  id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
  exit_price?: number;
  volume: number;
  pnl?: number;
  stop_loss?: number;
  take_profit?: number;
  entry_time: Date;
  exit_time?: Date;
  status?: 'open' | 'closed';
}

export async function saveTrade(trade: TradeRecord) {
  const { data, error } = await supabase
    .from('trades')
    .insert([{ ...trade, entry_time: trade.entry_time.toISOString() }])
    .select();
  
  if (error) {
    console.error('Error saving trade:', error);
    throw error;
  }
  return data;
}

export async function updateTradeClose(id: string, exit_price: number, pnl: number) {
  const { data, error } = await supabase
    .from('trades')
    .update({ 
      exit_price, 
      pnl, 
      exit_time: new Date().toISOString(), 
      status: 'closed' 
    })
    .eq('id', id);
  
  if (error) {
    console.error('Error updating trade:', error);
    throw error;
  }
  return data;
}

export async function getTradeHistory(limit = 100) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('entry_time', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching trades:', error);
    throw error;
  }
  return data;
}

export async function getPerformanceMetrics() {
  const { data, error } = await supabase
    .from('trades')
    .select('pnl, status, entry_time');
  
  if (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
  
  const closedTrades = data?.filter(t => t.status === 'closed') || [];
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length ? (winningTrades / closedTrades.length) * 100 : 0;
  
  return { totalPnL, winRate, totalTrades: data?.length || 0, closedTrades: closedTrades.length };
}

export async function saveSignal(symbol: string, action: string, confidence: number, reason: string) {
  const { data, error } = await supabase
    .from('signals')
    .insert([{ symbol, action, confidence, reason }])
    .select();
  
  if (error) {
    console.error('Error saving signal:', error);
    throw error;
  }
  return data;
}

export async function getRecentSignals(limit = 50) {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching signals:', error);
    throw error;
  }
  return data;
}
