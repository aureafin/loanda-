import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sb, kz } from '../supabase.js';
import ProductForm from './ProductForm.jsx';
import { Loading, Modal, toast, useSession } from '../ui.jsx';

const ST = { pendente: 'Pendente', confirmada: 'Confirmada', nao_realizada: 'Não realizada', cancelada: 'Cancelada' };
const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export default function Admin() {
  const s = useSession(); const nav = useNavigate();
  const [ok, setOk] = useState(undefined); const [d, setD] = useState(null); const [tab, setTab] = useState('produtos'); const [flt, setFlt] = useState('');
  const [conf, setConf] = useState(null); const [pay, setPay] = useState(null); const [form, setForm] = useState(null);
  const load = useCallback(async () => {
    const q = (t, sel, o) => { let x = sb.from(t).select(sel); return o ? x.order(o, { ascending: false }) : x; };
    const [r, c, a, p, ev, cat, pm] = await Promise.all([q('purchase_requests', '*, products(name), affiliates(profiles(full_name))', 'created_at'), q('commissions', 'affiliate_id,amount_kz,paid_kz'),
      q('affiliates', '*, profiles(full_name,phone), affiliate_bank(*)'), q('products', '*', 'created_at'), q('product_events', 'event_type'), q('categories', '*'), q('audit_logs', '*', 'created_at')]);
    setD({ r: r.data || [], c: c.data || [], a: a.data || [], p: p.data || [], ev: ev.data || [], cat: cat.data || [], log: (pm.data || []).slice(0, 50) });
  }, []);
  useEffect(() => { if (s === null) nav('/entrar'); else if (s) sb.from('admin_users').select('user_id').maybeSingle().then(({ data }) => { setOk(!!data); if (data) load(); }); }, [s]);
  if (ok === false) return <p className="wrap sec">Acesso negado.</p>;
  if (!d) return <Loading />;
  const act = async (fn, args, msg) => { const { error } = await sb.rpc(fn, args); if (error) return toast(error.message, 'err'); toast(msg); setConf(null); setPay(null); load(); };
  const pend = d.r.filter((x) => x.status === 'pendente').length, conf_ = d.r.filter((x) => x.status === 'confirmada');
  const owed = d.c.reduce((x, c) => x + c.amount_kz - c.paid_kz, 0), paid = d.c.reduce((x, c) => x + c.paid_kz, 0);
  const ev = (t) => d.ev.filter((e) => e.event_type === t).length;
  const wallet = (id) => { const l = d.c.filter((c) => c.affiliate_id === id); return { total: l.reduce((x, c) => x + c.amount_kz, 0), paid: l.reduce((x, c) => x + c.paid_kz, 0) }; };
  const Stat = ({ l, v }) => <div className="stat"><small>{l}</small><b>{v}</b></div>;
  const rows = d.r.filter((x) => !flt || x.status === flt);
  return <section className="wrap sec"><h2>Painel administrativo</h2>
    <div className="chips">{[['pedidos', 'Pedidos e Vendas'], ['pagamentos', 'Comissões e Pagamentos'], ['produtos', 'Produtos'], ['afiliados', 'Afiliados'], ['auditoria', 'Auditoria']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      <button onClick={() => sb.auth.signOut().then(() => nav('/'))}>Sair</button></div>
    <div className="grid4"><Stat l="Vendas confirmadas" v={conf_.length} /><Stat l="Volume de vendas" v={kz(conf_.reduce((x, r) => x + r.price_kz, 0))} /><Stat l="Solicitações" v={d.r.length} /><Stat l="Pendentes" v={pend} />
      <Stat l="Não realizadas" v={d.r.filter((x) => x.status === 'nao_realizada').length} /><Stat l="Afiliados" v={`${d.a.filter((x) => x.status === 'ativo').length}/${d.a.length}`} /><Stat l="Produtos publicados" v={d.p.filter((x) => x.is_published).length} /><Stat l="Visualizações / cliques" v={`${ev('view')} / ${ev('click')}`} />
      <Stat l="Encaminhamentos WhatsApp" v={ev('whatsapp')} /><Stat l="Comissões pendentes" v={kz(owed)} /><Stat l="Comissões pagas" v={kz(paid)} /></div>

    {tab === 'pedidos' && <><select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">Todas</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <div className="scroll"><table><thead><tr><th>Ref.</th><th>Produto</th><th>Afiliado</th><th>Preço</th><th>Data</th><th>Estado</th><th>Acção</th></tr></thead><tbody>{rows.map((r) => { const dt = new Date(r.created_at);
        return <tr key={r.id}><td>{r.public_code}</td><td>{r.products?.name}</td><td>{r.affiliates?.profiles?.full_name || 'Venda directa'}</td><td>{kz(r.price_kz)}</td><td>{dt.toLocaleDateString('pt-AO')} {dt.toLocaleTimeString('pt-AO')}</td><td>{ST[r.status]}</td>
          <td>{r.status === 'pendente' && <><button className="btn sm" onClick={() => setConf(r)}>Compra realizada</button> <button className="btn sm ghost" onClick={() => window.confirm('Marcar como não realizada?') && act('reject_sale', { p_request_id: r.id }, 'Pedido marcado como não realizado.')}>Não realizada</button></>}</td></tr>; })}</tbody></table></div></>}

    {tab === 'pagamentos' && <div className="scroll"><table><thead><tr><th>Afiliado</th><th>Titular</th><th>Banco</th><th>IBAN</th><th>Pendente</th><th>Pago</th><th></th></tr></thead><tbody>{d.a.map((a) => { const w = wallet(a.id), b = [].concat(a.affiliate_bank || [])[0] || {};
      return <tr key={a.id}><td>{a.profiles?.full_name}</td><td>{b.holder_name}</td><td>{b.bank}</td><td>{b.iban}</td><td>{kz(w.total - w.paid)}</td><td>{kz(w.paid)}</td>
        <td>{w.total - w.paid > 0 && <button className="btn sm" onClick={() => setPay({ a, pending: w.total - w.paid, amount: w.total - w.paid, date: new Date().toISOString().slice(0, 10), ref: '', key: crypto.randomUUID() })}>Registar pagamento</button>}</td></tr>; })}</tbody></table></div>}

    {tab === 'produtos' && <><button className="btn" onClick={() => setForm({ name: '', slug: '', short_description: '', description: '', category_id: '', type: 'livro', price_kz: 0, pct: 10, is_published: false, is_available: true, is_featured: false, cover_url: '', stock: '' })}>Novo produto</button>
      <div className="scroll"><table><thead><tr><th>Nome</th><th>Preço</th><th>Comissão</th><th>Estado</th><th></th></tr></thead><tbody>{d.p.map((p) => <tr key={p.id}><td>{p.name}</td><td>{kz(p.price_kz)}</td><td>{p.commission_bp / 100}%</td><td>{p.is_published ? 'Publicado' : 'Rascunho'}</td>
        <td><button className="btn sm ghost" onClick={() => setForm({ ...p, pct: p.commission_bp / 100, stock: p.stock ?? '', category_id: p.category_id || '', cover_url: p.cover_url || '' })}>Editar</button></td></tr>)}</tbody></table></div></>}

    {tab === 'afiliados' && <div className="scroll"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Local</th><th>Estado</th><th></th></tr></thead><tbody>{d.a.map((a) => <tr key={a.id}><td>{a.profiles?.full_name}</td><td>{a.profiles?.phone}</td><td>{a.municipality}, {a.province}</td><td>{a.status}</td>
      <td><button className="btn sm ghost" onClick={() => act('set_affiliate_status', { p_affiliate_id: a.id, p_status: a.status === 'ativo' ? 'suspenso' : 'ativo' }, 'Estado actualizado.')}>{a.status === 'ativo' ? 'Suspender' : 'Reactivar'}</button></td></tr>)}</tbody></table></div>}

    {tab === 'auditoria' && <div className="scroll"><table><thead><tr><th>Data</th><th>Acção</th><th>Detalhes</th></tr></thead><tbody>{d.log.map((l) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString('pt-AO')}</td><td>{l.action}</td><td className="small">{JSON.stringify(l.details)}</td></tr>)}</tbody></table></div>}

    {conf && <Modal title="Confirmar venda" onClose={() => setConf(null)}><p><b>{conf.products?.name}</b> · {kz(conf.price_kz)}<br />Afiliado: {conf.affiliates?.profiles?.full_name || 'Venda directa'}<br />Comissão: {conf.affiliates ? kz(Math.floor(conf.price_kz * conf.commission_bp / 10000)) : '—'} ({conf.commission_bp / 100}%)</p>
      <div className="row"><button className="btn ghost" onClick={() => setConf(null)}>Cancelar</button><button className="btn" onClick={() => act('confirm_sale', { p_request_id: conf.id }, 'Venda confirmada.')}>Confirmar</button></div></Modal>}
    {pay && <Modal title="Registar pagamento" onClose={() => setPay(null)}><p>{pay.a.profiles?.full_name} · pendente: <b>{kz(pay.pending)}</b></p>
      <div className="form"><label>Valor a pagar (Kz)<input type="number" min="1" max={pay.pending} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
        <label>Data<input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
        <label>Referência / comprovativo<input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} /></label></div>
      <div className="row"><button className="btn ghost" onClick={() => setPay(null)}>Cancelar</button><button className="btn" onClick={() => act('register_payment', { p_affiliate_id: pay.a.id, p_amount_kz: Math.round(+pay.amount), p_paid_on: pay.date, p_reference: pay.ref, p_key: pay.key }, 'Pagamento registado.')}>Confirmar pagamento</button></div></Modal>}
    {form && <ProductForm form={form} setForm={setForm} cats={d.cat} onClose={() => setForm(null)} onSaved={load} />}
  </section>;
}
