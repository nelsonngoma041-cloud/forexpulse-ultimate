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

export interface SignalRecord {
  id?: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  executed?: boolean;
  created_at?: Date;
}

export async function saveTrade(trade: TradeRecord) {
  try {
    const { data, error } = await supabase
      .from('trades')
      .insert([{ 
        ...trade, 
        entry_time: trade.entry_time.toISOString(),
        exit_time: trade.exit_time?.toISOString()
      }])
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving trade:', error);
    return null;
  }
}

export async function updateTradeClose(id: string, exit_price: number, pnl: number) {
  try {
    const { data, error } = await supabase
      .from('trades')
      .update({ 
        exit_price, 
        pnl, 
        exit_time: new Date().toISOString(), 
        status: 'closed' 
      })
      .eq('id', id);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating trade:', error);
    return null;
  }
}

export async function getTradeHistory(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('entry_time', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

export async function getPerformanceMetrics() {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('pnl, status, entry_time');
    
    if (error) throw error;
    
    const closedTrades = data?.filter(t => t.status === 'closed') || [];
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length ? (winningTrades / closedTrades.length) * 100 : 0;
    
    return { 
      totalPnL, 
      winRate, 
      totalTrades: data?.length || 0, 
      closedTrades: closedTrades.length 
    };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return { totalPnL: 0, winRate: 0, totalTrades: 0, closedTrades: 0 };
  }
}

export async function saveSignal(signal: SignalRecord) {
  try {
    const { data, error } = await supabase
      .from('signals')
      .insert([{ 
        ...signal, 
        created_at: new Date().toISOString() 
      }])
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving signal:', error);
    return null;
  }
}

export async function getRecentSignals(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching signals:', error);
    return [];
  }
}

export async function getDailyPerformance(date?: Date) {
  try {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('performance')
      .select('*')
      .eq('date', dateStr)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || { date: dateStr, daily_pnl: 0, total_trades: 0, winning_trades: 0 };
  } catch (error) {
    console.error('Error fetching daily performance:', error);
    return { date: new Date().toISOString().split('T')[0], daily_pnl: 0, total_trades: 0, winning_trades: 0 };
  }
}

export async function updateDailyPerformance(date: Date, daily_pnl: number, total_trades: number, winning_trades: number) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('performance')
      .upsert({ 
        date: dateStr, 
        daily_pnl, 
        total_trades, 
        winning_trades,
        created_at: new Date().toISOString()
      })
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating daily performance:', error);
    return null;
  }
}

export async function deleteTrade(id: string) {
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting trade:', error);
    return false;
  }
}

export async function getOpenTrades() {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'open')
      .order('entry_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching open trades:', error);
    return [];
  }
}
