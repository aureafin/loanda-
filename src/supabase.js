import { createClient } from '@supabase/supabase-js';
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL || 'http://localhost', import.meta.env.VITE_SUPABASE_ANON_KEY || 'x');
export const kz = (n) => new Intl.NumberFormat('pt-AO').format(n || 0) + ' Kz';
export const WHATSAPP = '244954972677';
const DAY = 864e5, TTL = 30 * DAY; // atribuição: 30 dias, último clique válido
export const visitorId = () => { try { let v = localStorage.getItem('la_vid'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('la_vid', v); } return v; } catch { return null; } };
export const saveRef = (code, productId) => { try { localStorage.setItem('la_ref', JSON.stringify({ code, productId, ts: Date.now() })); } catch {} };
export const getRef = (productId) => { try { const r = JSON.parse(localStorage.getItem('la_ref')); return r && r.productId === productId && Date.now() - r.ts < TTL ? r.code : null; } catch { return null; } };
