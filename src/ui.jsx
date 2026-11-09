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
  const { pathname, search } = useLocation();
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
}
export const Loading = () => <p className="muted center">A carregar…</p>;
