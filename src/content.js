import { useEffect, useState } from 'react';
import { sb } from './supabase.js';
let cache = null, pending = null;
export const loadContent = () => cache ? Promise.resolve(cache) : (pending ||= sb.from('site_content').select('key,value').then(({ data }) => (cache = Object.fromEntries((data || []).map((r) => [r.key, r.value])))));
export const bustContent = () => { cache = null; pending = null; };
export function useContent() { const [c, setC] = useState(cache || {}); useEffect(() => { loadContent().then(setC); }, []); return c; }
export const lines = (t) => (t || '').split('\n').map((x) => x.trim()).filter(Boolean);
export const pairs = (t) => lines(t).map((l) => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
export const blocks = (t) => (t || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
