import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { Toaster, useReveal, useSession } from './ui.jsx';
import { WHATSAPP, sb } from './supabase.js';
import Home, { Programa, Sobre, Catalog } from './Pages/Home.jsx';
import Product from './Pages/Product.jsx';
import Auth from './Pages/Auth.jsx';
import Affiliate from './Pages/Affiliate.jsx';
import Admin from './Pages/Admin.jsx';

function Header() {
  const [open, setOpen] = useState(false);
  const s = useSession();
  const [adm, setAdm] = useState(false);
  useEffect(() => { if (!s) return setAdm(false); sb.from('admin_users').select('user_id').maybeSingle().then(({ data }) => setAdm(!!data)); }, [s]);
  const L = ({ to, children }) => <Link to={to} onClick={() => setOpen(false)}>{children}</Link>;
  return <header className="hdr"><div className="wrap bar">
    <Link to="/" className="logo">LOANDA <b>AFILIADOS</b></Link>
    <button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
    <nav className={open ? 'open' : ''}>
      <L to="/">Início</L><L to="/produtos?cat=livros">Livros</L><L to="/produtos?cat=cursos">Cursos</L>
      <L to="/produtos?cat=documentos">Documentos e Modelos</L><L to="/produtos">Produtos</L>
      <L to="/afiliados">Programa de Afiliados</L><L to="/sobre">Sobre nós</L>
      <L to={adm ? '/admin' : s ? '/conta' : '/entrar'}>{adm ? 'Painel Admin' : s ? 'Minha conta' : 'Entrar'}</L>
      {s && <a href="#/" onClick={(e) => { e.preventDefault(); setOpen(false); sb.auth.signOut().then(() => { location.hash = '#/'; }); }}>Sair</a>}
    </nav></div></header>;
}
const Footer = () => <footer className="ftr"><div className="wrap grid3">
  <div><div className="logo">LOANDA <b>AFILIADOS</b></div><p className="muted">Canal de comercialização de produtos e ferramentas profissionais da Loanda Consultoria.</p></div>
  <div><h4>Navegação</h4><Link to="/produtos">Produtos</Link><Link to="/afiliados">Programa de Afiliados</Link><Link to="/sobre">Sobre nós</Link></div>
  <div><h4>Contactos</h4><a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp +{WHATSAPP}</a><Link to="/legal">Política de privacidade</Link><Link to="/legal">Termos e condições</Link></div>
  </div><p className="center muted small">© {new Date().getFullYear()} Loanda Afiliados · Todos os direitos reservados</p></footer>;
const Legal = () => <section className="wrap sec"><h2>Política de privacidade</h2><p>Guardamos os dados fornecidos no registo e na navegação por links de afiliados (identificador de visitante e referência, por até 30 dias) apenas para atribuir vendas e calcular comissões. Dados bancários são visíveis apenas ao próprio afiliado e ao administrador.</p><h2>Termos e condições</h2><p>Comissões só são devidas por vendas confirmadas pelo administrador. Contas podem ser suspensas por actividade abusiva, sem perda do histórico financeiro. <b>Texto-base: rever com assessoria jurídica antes de publicar.</b></p></section>;

export default function App() {
  useReveal();
  return <><Header /><main>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/produtos" element={<section className="wrap sec"><Catalog /></section>} />
      <Route path="/produto/:slug" element={<Product />} />
      <Route path="/afiliados" element={<Programa />} />
      <Route path="/sobre" element={<Sobre />} />
      <Route path="/entrar" element={<Auth />} />
      <Route path="/conta" element={<Affiliate />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="*" element={<p className="wrap sec">Página não encontrada.</p>} />
    </Routes></main><Footer /><Toaster /></>;
}
