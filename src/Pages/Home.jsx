import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sb, kz } from '../supabase.js';
import { Loading } from '../ui.jsx';
import BuyButton from '../BuyButton.jsx';

export function Catalog() {
  const [sp, setSp] = useSearchParams();
  const cat = sp.get('cat') || '';
  const [cats, setCats] = useState([]); const [items, setItems] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { sb.from('categories').select('*').order('sort_order').then(({ data }) => setCats(data || [])); }, []);
  useEffect(() => {
    setItems(null);
    let q = sb.from('products').select('id,slug,name,short_description,price_kz,cover_url,is_available,categories(slug,name)').eq('is_published', true).order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    q.then(({ data, error }) => { if (error) setErr(error.message); setItems((data || []).filter((p) => !cat || p.categories?.slug === cat)); });
  }, [cat]);
  return <div id="produtos"><h2 className="reveal">Produtos</h2>
    <div className="chips"><button className={!cat ? 'on' : ''} onClick={() => setSp({})}>Todos</button>
      {cats.map((c) => <button key={c.id} className={cat === c.slug ? 'on' : ''} onClick={() => setSp({ cat: c.slug })}>{c.name}</button>)}</div>
    {err && <p className="err">Não foi possível carregar: {err}</p>}
    {!items ? <Loading /> : items.length === 0 ? <p className="muted center">Ainda não há produtos publicados nesta categoria.</p> :
      <div className="grid">{items.map((p) => <article className="card reveal" key={p.id}>
        <div className="cover" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : null}>{!p.cover_url && '📘'}</div>
        <div className="body"><span className="tag">{p.categories?.name || 'Produto'}</span><h3>{p.name}</h3><p className="muted">{p.short_description}</p>
          <div className="price">{kz(p.price_kz)} <small>{p.is_available ? 'Disponível' : 'Indisponível'}</small></div>
          <div className="row"><BuyButton product={p} /><Link className="btn ghost block" to={`/produto/${p.slug}`}>Ver detalhes</Link></div></div></article>)}</div>}
  </div>;
}
export const Programa = () => <section className="wrap sec"><h2 className="reveal">Programa de Afiliados</h2>
  <p className="reveal">Promova produtos da Loanda Afiliados através do seu link exclusivo e receba comissões pelas vendas confirmadas.</p>
  <div className="grid3">{[['1. Registe-se', 'Crie a sua conta gratuita com os seus dados e dados bancários.'], ['2. Promova', 'Escolha produtos e gere o seu link exclusivo para partilhar.'], ['3. Receba', 'Cada venda confirmada gera comissão na sua carteira, paga pelo administrador.']].map(([t, d]) => <div className="panel reveal" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>)}</div>
  <div className="row"><Link className="btn" to="/entrar?modo=registo">Tornar-me afiliado</Link><Link className="btn ghost" to="/entrar">Aceder à minha conta</Link></div></section>;
export const Sobre = () => <section className="wrap sec"><h2 className="reveal">Sobre a plataforma</h2>
  <p className="reveal">A Loanda Afiliados é um canal de comercialização de produtos, conteúdos e ferramentas profissionais associado à actividade da Loanda Consultoria. A gestão comercial é independente, dentro da mesma estrutura empresarial.</p></section>;
export default function Home() {
  return <><section className="hero"><div className="wrap">
    <h1 className="reveal">Conhecimento, ferramentas e oportunidades para crescer.</h1>
    <p className="reveal">Encontre livros, cursos, documentos profissionais e ferramentas práticas para desenvolver os seus projectos, negócios e competências.</p>
    <div className="row reveal"><a className="btn" href="#/produtos">Explorar produtos</a><Link className="btn ghost" to="/entrar?modo=registo">Tornar-me afiliado</Link></div></div></section>
    <section className="wrap sec"><Catalog /></section>
    <div className="band"><Programa /></div><Sobre /></>;
}
