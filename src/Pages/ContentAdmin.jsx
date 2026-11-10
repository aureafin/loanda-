import { useEffect, useState } from 'react';
import { sb } from '../supabase.js';
import { toast } from '../ui.jsx';
import { bustContent } from '../content.js';

const FIELDS = [
  ['aviso', 'Aviso no topo do site (deixe vazio para esconder)', 2], ['hero_title', 'Banner principal: título', 2], ['hero_text', 'Banner principal: texto', 5],
  ['categorias', 'O que encontra na plataforma (uma linha por item: Título | descrição)', 8], ['vantagens', 'Porquê a Loanda Afiliados (uma vantagem por linha)', 6],
  ['cta_text', 'Chamada «Comece hoje»', 4], ['afiliado_intro', 'Programa de afiliados: introdução (parágrafos separados por linha vazia)', 8],
  ['como_funciona', 'Como funciona (uma linha por passo: Título | descrição)', 6], ['quem_pode', 'Quem pode participar', 4], ['importante', 'Aviso «Importante» (sem promessa de rendimento)', 4],
  ['sobre_text', 'Sobre nós', 8], ['missao', 'Missão', 3], ['visao', 'Visão', 3], ['valores', 'Valores (um por linha)', 5],
  ['faq', 'Perguntas frequentes (pergunta na 1.ª linha, resposta a seguir; separe perguntas com linha vazia)', 14], ['footer_desc', 'Rodapé: descrição', 3],
  ['termos', 'Termos e condições', 8], ['privacidade', 'Política de privacidade', 8]];

export default function ContentAdmin() {
  const [v, setV] = useState(null); const [busy, setBusy] = useState('');
  useEffect(() => { sb.from('site_content').select('key,value').then(({ data, error }) => error ? toast(error.message, 'err') : setV(Object.fromEntries((data || []).map((r) => [r.key, r.value])))); }, []);
  const save = async (k) => { setBusy(k); const { error } = await sb.from('site_content').upsert({ key: k, value: v[k] || '', updated_at: new Date().toISOString() }); setBusy('');
    if (error) return toast(error.message, 'err'); bustContent(); toast('Guardado. Já aparece no site.'); };
  if (!v) return <p className="muted">A carregar…</p>;
  return <div>{FIELDS.map(([k, l, r]) => <div className="panel" key={k}><label>{l}<textarea rows={r} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
    <button className="btn sm" disabled={busy === k} onClick={() => save(k)}>{busy === k ? 'A guardar…' : 'Guardar'}</button></div>)}</div>;
}
