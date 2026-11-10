import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { sb, kz, WHATSAPP, visitorId, saveRef, getRef } from '../supabase.js';
import { Loading, Modal, toast } from '../ui.jsx';

export default function Product() {
  const { slug } = useParams(); const [sp] = useSearchParams();
  const [p, setP] = useState(undefined); const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    sb.from('products').select('*, categories(name)').eq('slug', slug).eq('is_published', true).maybeSingle().then(({ data }) => {
      setP(data || null);
      if (!data) return;
      const ref = sp.get('ref'); if (ref) saveRef(ref, data.id);
      sb.rpc('track_event', { p_product_id: data.id, p_ref_code: getRef(data.id), p_type: 'view', p_visitor: visitorId() });
    });
  }, [slug]);
  if (p === undefined) return <Loading />;
  if (!p) return <p className="wrap sec">Produto não encontrado.</p>;
  const buy = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc('create_purchase_request', { p_product_id: p.id, p_ref_code: getRef(p.id), p_visitor: visitorId() });
    setBusy(false);
    if (error || !data?.[0]) return toast('Não foi possível registar o pedido. Tente novamente.', 'err');
    const msg = `Olá! Tenho interesse em adquirir o produto ${data[0].product_name}.\n\nReferência da solicitação: ${data[0].public_code}.\n\nGostaria de obter informações para concluir a compra.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
    setAsk(false); toast('Pedido registado. Conclua a compra no WhatsApp.');
  };
  return <section className="wrap sec two">
    <div className="cover big" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : null}>{!p.cover_url && '📘'}</div>
    <div><span className="tag">{p.categories?.name}</span><h1>{p.name}</h1><p className="price">{kz(p.price_kz)}</p>
      <p>{p.short_description}</p><p className="muted" style={{ whiteSpace: 'pre-line' }}>{p.description}</p>
      {(p.gallery || []).length > 0 && <div className="row">{p.gallery.map((u) => <img key={u} src={u} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />)}</div>}
      {p.course_content && <><h3>Conteúdo do curso</h3><p className="muted" style={{ whiteSpace: 'pre-line' }}>{p.course_content}</p></>}
      <button className="btn" disabled={!p.is_available} onClick={() => setAsk(true)}>{p.is_available ? 'Comprar' : 'Indisponível'}</button></div>
    {ask && <Modal title="Confirmar compra" onClose={() => setAsk(false)}>
      <p>Vamos registar o seu pedido de <b>{p.name}</b> ({kz(p.price_kz)}) e abrir o WhatsApp para concluir a compra. O pedido só é considerado venda depois de confirmado.</p>
      <div className="row"><button className="btn ghost" onClick={() => setAsk(false)}>Cancelar</button><button className="btn" disabled={busy} onClick={buy}>{busy ? 'A registar…' : 'Continuar'}</button></div></Modal>}
  </section>;
}
