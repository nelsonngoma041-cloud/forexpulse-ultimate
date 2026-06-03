// app/api/test-db/route.ts
import { NextResponse } from 'next/server';
import { supabase, getPerformanceMetrics } from '@/app/lib/supabase';

export async function GET() {
  try {
    // Test connection
    const { data, error } = await supabase.from('trades').select('count', { count: 'exact' });
    
    if (error) throw error;
    
    const metrics = await getPerformanceMetrics();
    
    return NextResponse.json({
      success: true,
      message: 'Database connected!',
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
