import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sb, kz } from '../supabase.js';
import { Loading, toast, useSession } from '../ui.jsx';

const link = (slug, code) => `${location.origin}${location.pathname}#/produto/${slug}?ref=${code}`;
export default function Affiliate() {
  const s = useSession(); const nav = useNavigate();
  const [d, setD] = useState(null); const [fail, setFail] = useState(false); const [tab, setTab] = useState('resumo'); const [days, setDays] = useState(30);
  const load = useCallback(async () => {
    const u = s.user;
    const { data: adm } = await sb.from('admin_users').select('user_id').maybeSingle();
    if (adm) return nav('/admin');
    let { data: aff } = await sb.from('affiliates').select('*').maybeSingle();
    if (!aff) { // primeiro login: completa o registo a partir dos dados do formulário
      const m = u.user_metadata || {};
      const e1 = (await sb.from('profiles').upsert({ id: u.id, full_name: m.full_name, phone: m.phone })).error;
      const e2 = !e1 && (await sb.from('affiliates').insert({ id: u.id, province: m.province, municipality: m.municipality })).error;
      const e3 = !e1 && !e2 && (await sb.from('affiliate_bank').insert({ affiliate_id: u.id, holder_name: m.holder, bank: m.bank, iban: m.iban })).error;
      if (e1 || e2 || e3) { setFail(true); return toast('Não foi possível concluir o registo do afiliado.', 'err'); }
      await sb.auth.updateUser({ data: { holder: null, bank: null, iban: null } });
      ({ data: aff } = await sb.from('affiliates').select('*').maybeSingle());
    }
    const [prof, prods, aps, ev, com, pay, nt] = await Promise.all([
      sb.from('profiles').select('full_name').maybeSingle(),
      sb.from('products').select('id,name,slug,price_kz,commission_bp').eq('is_published', true),
      sb.from('affiliate_products').select('*, products(name,slug,price_kz,commission_bp)'),
      sb.from('product_events').select('event_type,affiliate_product_id,created_at'),
      sb.from('commissions').select('amount_kz,paid_kz,created_at'),
      sb.from('affiliate_payments').select('*').order('paid_on', { ascending: false }),
      sb.from('notifications').select('*').order('created_at', { ascending: false })]);
    setD({ aff, name: prof.data?.full_name, prods: prods.data || [], aps: aps.data || [], ev: ev.data || [], com: com.data || [], pay: pay.data || [], nt: nt.data || [] });
  }, [s]);
  useEffect(() => { if (s === null) nav('/entrar'); else if (s) load(); }, [s]);
  useEffect(() => { // notificações em tempo real
    if (!s) return; const ch = sb.channel('nt').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${s.user.id}` }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [s]);
  if (fail) return <section className="wrap sec narrow"><p className="err">Esta conta não tem registo de afiliado completo.</p><button className="btn" onClick={() => sb.auth.signOut().then(() => nav('/entrar'))}>Sair e entrar com outra conta</button></section>;
  if (!d) return <Loading />;
  const since = Date.now() - days * 864e5, ev = d.ev.filter((e) => new Date(e.created_at) >= since);
  const n = (t) => ev.filter((e) => e.event_type === t).length;
  const total = d.com.reduce((a, c) => a + c.amount_kz, 0), paid = d.com.reduce((a, c) => a + c.paid_kz, 0);
  const promote = async (id) => { const { error } = await sb.rpc('promote_product', { p_product_id: id }); error ? toast(error.message, 'err') : (toast('Link gerado.'), load()); };
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast('Link copiado.'));
  const read = async (id) => { await sb.from('notifications').update({ is_read: true }).eq('id', id); load(); };
  const unread = d.nt.filter((x) => !x.is_read).length;
  const Stat = ({ l, v }) => <div className="stat"><small>{l}</small><b>{v}</b></div>;
  return <section className="wrap sec"><h2>Olá, {d.name}</h2>{d.aff.status === 'suspenso' && <p className="err">A sua conta está suspensa: não são geradas novas atribuições.</p>}
    <div className="chips">{[['resumo', 'Resumo'], ['produtos', 'Produtos e links'], ['carteira', 'Minha carteira'], ['notif', `Notificações${unread ? ` (${unread})` : ''}`]].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      <button onClick={() => sb.auth.signOut().then(() => nav('/'))}>Sair</button></div>
    {tab === 'resumo' && <><select value={days} onChange={(e) => setDays(+e.target.value)}><option value={1}>Hoje</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select>
      <div className="grid4"><Stat l="Visualizações" v={n('view')} /><Stat l="Cliques" v={n('click')} /><Stat l="Encaminhamentos WhatsApp" v={n('whatsapp')} /><Stat l="Vendas confirmadas" v={d.com.length} />
        <Stat l="Conversão" v={n('view') ? ((d.com.length / n('view')) * 100).toFixed(1) + '%' : '0%'} /><Stat l="Comissões acumuladas" v={kz(total)} /><Stat l="Saldo pendente" v={kz(total - paid)} /><Stat l="Comissões pagas" v={kz(paid)} /></div></>}
    {tab === 'produtos' && <div className="grid">{d.prods.map((p) => { const ap = d.aps.find((a) => a.product_id === p.id); const url = ap && link(p.slug, ap.ref_code);
      return <div className="panel" key={p.id}><h3>{p.name}</h3><p className="muted">Comissão {p.commission_bp / 100}% · {kz(Math.floor(p.price_kz * p.commission_bp / 10000))} por venda</p>
        {ap ? <><input readOnly value={url} onFocus={(e) => e.target.select()} /><div className="row"><button className="btn" onClick={() => copy(url)}>Copiar</button>
          <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(p.name + ' ' + url)}`}>WhatsApp</a></div>
          <p className="small muted">{d.ev.filter((e) => e.affiliate_product_id === ap.id && e.event_type === 'view').length} visualizações · {d.ev.filter((e) => e.affiliate_product_id === ap.id && e.event_type === 'whatsapp').length} encaminhamentos</p></>
          : <button className="btn" onClick={() => promote(p.id)}>Promover este produto</button>}</div>; })}</div>}
    {tab === 'carteira' && <><div className="grid3"><Stat l="Saldo pendente" v={kz(total - paid)} /><Stat l="Total recebido" v={kz(paid)} /><Stat l="Total histórico" v={kz(total)} /></div>
      <h3>Histórico de pagamentos</h3>{d.pay.length ? <table><thead><tr><th>Data</th><th>Valor</th><th>Referência</th></tr></thead><tbody>{d.pay.map((x) => <tr key={x.id}><td>{x.paid_on}</td><td>{kz(x.amount_kz)}</td><td>{x.reference || '—'}</td></tr>)}</tbody></table> : <p className="muted">Ainda sem pagamentos.</p>}</>}
    {tab === 'notif' && (d.nt.length ? d.nt.map((x) => <div key={x.id} className={'panel nt' + (x.is_read ? '' : ' new')}><b>{x.title}</b><p>{x.body}</p><small className="muted">{new Date(x.created_at).toLocaleString('pt-AO')}</small>{!x.is_read && <button className="link" onClick={() => read(x.id)}>Marcar como lida</button>}</div>) : <p className="muted">Sem notificações.</p>)}
  </section>;
}
