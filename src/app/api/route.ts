import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// GET /api?address=0x...  -> 返回该地址分数（默认 0）
// GET /api                -> 返回 Top 20 排行（可选）
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (address) {
    const { data, error } = await supabase
      .from('scores')
      .select('address, score, updated_at')
      .eq('address', address.toLowerCase())
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ address: address.toLowerCase(), score: data?.score ?? 0 });
  }

  const { data, error } = await supabase
    .from('scores')
    .select('address, score, updated_at')
    .order('score', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaderboard: data });
}

// POST /api  { address, score } -> upsert 分数
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address: string | undefined = body?.address;
  const score: number | undefined = body?.score;

  if (!address || typeof score !== 'number') {
    return NextResponse.json({ error: 'address 和 score 必填' }, { status: 400 });
  }

  const norm = address.toLowerCase();
  const { error } = await supabase
    .from('scores')
    .upsert({ address: norm, score, updated_at: new Date().toISOString() }, { onConflict: 'address' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
