import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sb } from './supabase.js';
export const toast = (msg, type = 'ok') => window.dispatchEvent(new CustomEvent('la-toast', { detail: { msg, type } }));
export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { const h = (e) => { setT(e.detail); setTimeout(() => setT(null), 4000); }; window.addEventListener('la-toast', h); return () => window.removeEventListener('la-toast', h); }, []);
  return t ? <div className={'toast ' + t.type} role="status">{t.msg}</div> : null;
}
export function Modal({ title, onClose, children }) {
  return <div className="overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"><h3>{title}</h3>{children}</div></div>;
}
export function useSession() {
  const [s, setS] = useState(undefined);
  useEffect(() => { sb.auth.getSession().then(({ data }) => setS(data.session)); const { data } = sb.auth.onAuthStateChange((_e, x) => setS(x)); return () => data.subscription.unsubscribe(); }, []);
  return s;
}
export function useReveal() {
  const { pathname } = useLocation();
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
    const io = reduce ? null : new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    const scan = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
    scan();
    const mo = new MutationObserver(scan); // apanha elementos que chegam depois (ex.: produtos carregados do Supabase)
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io?.disconnect(); mo.disconnect(); };
  }, [pathname]);
}
export const Loading = () => <p className="muted center">A carregar…</p>;
