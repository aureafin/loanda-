import { useState } from 'react';
import { createPortal } from 'react-dom';
import { sb, kz, WHATSAPP, visitorId, getRef } from './supabase.js';
import { Modal, toast } from './ui.jsx';

export default function BuyButton({ product: p, className = 'btn buy block' }) {
  const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false);
  const buy = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc('create_purchase_request', { p_product_id: p.id, p_ref_code: getRef(p.id), p_visitor: visitorId() });
    setBusy(false);
    if (error || !data?.[0]) return toast('Não foi possível registar o pedido. Tente novamente.', 'err');
    const msg = `Olá! Tenho interesse em adquirir o produto ${data[0].product_name}.\n\nReferência da solicitação: ${data[0].public_code}.\n\nGostaria de obter informações para concluir a compra.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
    setAsk(false); toast('Pedido registado. Conclua a compra no WhatsApp.');
  };
  return <>
    <button className={className} disabled={!p.is_available} onClick={() => setAsk(true)}>{p.is_available ? 'Comprar agora' : 'Indisponível'}</button>
    {ask && createPortal(<Modal title="Confirmar compra" onClose={() => setAsk(false)}>
      <p>Vamos registar o seu pedido de <b>{p.name}</b> ({kz(p.price_kz)}) e abrir o WhatsApp para concluir a compra. O pedido só é considerado venda depois de confirmado.</p>
      <div className="row"><button className="btn ghost" onClick={() => setAsk(false)}>Cancelar</button><button className="btn buy" disabled={busy} onClick={buy}>{busy ? 'A registar…' : 'Continuar'}</button></div></Modal>, document.body)}
  </>;
}
