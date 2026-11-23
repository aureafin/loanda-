import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sb, kz } from '../supabase.js';
import { Loading, toast, useSession } from '../ui.jsx';
import { ChartModal, byDay, cumul, short } from '../Charts.jsx';

const link = (slug, code) => `${location.origin}${location.pathname}#/produto/${slug}?ref=${code}`;
const TABS = [['inicio', '🏠', 'Início'], ['resumo', '📊', 'Resumo'], ['produtos', '🔗', 'Produtos e links'], ['carteira', '💰', 'Carteira'], ['notif', '🔔', 'Notificações']];
export default function Affiliate() {
  const s = useSession(); const nav = useNavigate();
  const [d, setD] = useState(null); const [fail, setFail] = useState(false); const [tab, setTab] = useState('inicio'); const [days, setDays] = useState(30); const [chart, setChart] = useState(null);
  const load = useCallback(async () => {
    const u = s.user;
    const { data: adm } = await sb.from('admin_users').select('user_id').maybeSingle();
    if (adm) return nav('/admin');
    let { data: aff } = await sb.from('affiliates').select('*').maybeSingle();
    if (!aff) {
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
  useEffect(() => {
    if (!s) return; const ch = sb.channel('nt').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${s.user.id}` }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [s]);
  if (fail) return <section className="wrap sec narrow"><p className="err">Esta conta não tem registo de afiliado completo.</p><button className="btn" onClick={() => sb.auth.signOut().then(() => nav('/entrar'))}>Sair e entrar com outra conta</button></section>;
  if (!d) return <p className="muted center">A carregar…</p>;
  const since = Date.now() - days * 864e5, evf = d.ev.filter((e) => new Date(e.created_at) >= since);
  const n = (t) => evf.filter((e) => e.event_type === t).length, evd = (t) => d.ev.filter((e) => e.event_type === t), N = Math.max(days, 7);
  const total = d.com.reduce((a, c) => a + c.amount_kz, 0), paid = d.com.reduce((a, c) => a + c.paid_kz, 0), pend = total - paid;
  const pie = { type: 'pie', fmt: kz, data: [{ label: 'Pendente', value: pend }, { label: 'Pago', value: paid }] };
  const stats = [
    ['Visualizações', n('view'), () => ({ type: 'line', data: byDay(evd('view'), N) })],
    ['Cliques', n('click'), () => ({ type: 'bar', data: byDay(evd('click'), N) })],
    ['Encaminhamentos WhatsApp', n('whatsapp'), () => ({ type: 'bar', data: byDay(evd('whatsapp'), N) })],
    ['Vendas confirmadas', d.com.length, () => ({ type: 'bar', data: byDay(d.com, N) })],
    ['Conversão', n('view') ? ((d.com.length / n('view')) * 100).toFixed(1) + '%' : '0%', () => ({ type: 'pie', data: [{ label: 'Visualizações', value: n('view') }, { label: 'Encaminhamentos', value: n('whatsapp') }, { label: 'Vendas', value: d.com.length }] })],
    ['Comissões acumuladas', kz(total), () => ({ type: 'line', data: cumul(byDay(d.com, N, (c) => c.amount_kz)) })],
    ['Saldo pendente', kz(pend), () => pie], ['Comissões pagas', kz(paid), () => pie]];
  const Stat = ({ l, v, g }) => <button type="button" className="stat" onClick={() => setChart({ title: l, ...g() })}><small>{l}</small><b>{v}</b><i>Ver gráfico ›</i></button>;
  const promote = async (id) => { const { error } = await sb.rpc('promote_product', { p_product_id: id }); error ? toast(error.message, 'err') : (toast('Link gerado.'), load()); };
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast('Link copiado.'));
  const read = async (id) => { await sb.from('notifications').update({ is_read: true }).eq('id', id); load(); };
  const unread = d.nt.filter((x) => !x.is_read).length;
  return <section className="wrap sec">
    <div className="panel between"><div><small className="muted">Área do afiliado</small><h2 style={{ margin: 0 }}>Olá, {d.name}</h2></div><button className="btn sm ghost" onClick={() => sb.auth.signOut().then(() => nav('/'))}>Sair</button></div>
    {d.aff.status === 'suspenso' && <p className="err">A sua conta está suspensa: não são geradas novas atribuições.</p>}
    <div className="tiles">{TABS.map(([k, i, l]) => <button key={k} className={'tile' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><span>{i}</span>{k === 'notif' && unread ? `${l} (${unread})` : l}</button>)}</div>

    {tab === 'inicio' && <>
      <div className="panel hero-card"><h3>Bem-vindo(a) ao Programa de Afiliados Loanda! 👋</h3><p>Aqui divulga produtos, acompanha o seu desempenho e recebe comissões pelas vendas confirmadas através do seu link.</p></div>
      <div className="grid">
        <div className="panel"><h3>🎯 O que é o programa</h3><p className="muted">Você promove produtos da Loanda Afiliados e recebe uma comissão por cada venda confirmada feita através do seu link exclusivo.</p></div>
        <div className="panel"><h3>📚 O que vai divulgar</h3><p className="muted">Livros digitais, cursos, documentos profissionais, modelos editáveis, planilhas e outros produtos disponíveis na plataforma.</p></div>
        <div className="panel"><h3>💰 Como ganha dinheiro</h3><ol className="muted"><li>Em «Produtos e links», toque em «Promover este produto».</li><li>Copie o seu link e partilhe no WhatsApp, redes sociais e grupos.</li><li>Quando alguém comprar pelo seu link e a venda for confirmada, a comissão entra na sua carteira.</li><li>O administrador regista o pagamento e você recebe uma notificação.</li></ol></div>
        <div className="panel"><h3>🌱 Objetivo do programa</h3><p className="muted">Criar oportunidades de emprego e uma renda alternativa para quem sabe comunicar e vender. Os ganhos dependem das vendas realmente confirmadas; não há rendimento fixo garantido.</p></div></div>
      <button className="btn buy block" onClick={() => setTab('produtos')}>Começar: escolher produtos para divulgar</button></>}

    {tab === 'resumo' && <><select value={days} onChange={(e) => setDays(+e.target.value)}><option value={1}>Hoje</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select>
      <div className="grid4">{stats.map(([l, v, g]) => <Stat key={l} l={l} v={v} g={g} />)}</div></>}

    {tab === 'produtos' && <div className="grid">{d.prods.map((p) => { const ap = d.aps.find((a) => a.product_id === p.id); const url = ap && link(p.slug, ap.ref_code);
      return <div className="panel" key={p.id}><h3>{p.name}</h3><p className="muted">Comissão {p.commission_bp / 100}% · {kz(Math.floor(p.price_kz * p.commission_bp / 10000))} por venda</p>
        {ap ? <><input readOnly value={url} onFocus={(e) => e.target.select()} /><div className="row"><button className="btn" onClick={() => copy(url)}>Copiar</button>
          <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(p.name + ' ' + url)}`}>WhatsApp</a></div>
          <p className="small muted">{d.ev.filter((e) => e.affiliate_product_id === ap.id && e.event_type === 'view').length} visualizações · {d.ev.filter((e) => e.affiliate_product_id === ap.id && e.event_type === 'whatsapp').length} encaminhamentos</p></>
          : <button className="btn" onClick={() => promote(p.id)}>Promover este produto</button>}</div>; })}</div>}

    {tab === 'carteira' && <><div className="grid4"><Stat l="Saldo pendente" v={kz(pend)} g={() => pie} /><Stat l="Total recebido" v={kz(paid)} g={() => pie} /><Stat l="Total histórico" v={kz(total)} g={() => ({ type: 'line', data: cumul(byDay(d.com, 30, (c) => c.amount_kz)) })} /></div>
      <h3>Histórico de pagamentos</h3>{d.pay.length ? <div className="scroll"><table><thead><tr><th>Data</th><th>Valor</th><th>Referência</th></tr></thead><tbody>{d.pay.map((x) => <tr key={x.id}><td>{x.paid_on}</td><td>{kz(x.amount_kz)}</td><td>{x.reference || '—'}</td></tr>)}</tbody></table></div> : <p className="muted">Ainda sem pagamentos.</p>}</>}

    {tab === 'notif' && (d.nt.length ? d.nt.map((x) => <div key={x.id} className={'panel nt' + (x.is_read ? '' : ' new')}><b>{x.title}</b><p>{x.body}</p><small className="muted">{new Date(x.created_at).toLocaleString('pt-AO')}</small>{!x.is_read && <button className="link" onClick={() => read(x.id)}>Marcar como lida</button>}</div>) : <p className="muted">Sem notificações.</p>)}
    {chart && <ChartModal {...chart} onClose={() => setChart(null)} />}
  </section>;
}
