import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sb, kz } from '../supabase.js';
import { Loading } from '../ui.jsx';
import BuyButton from '../BuyButton.jsx';
import { useContent, pairs, lines, blocks } from '../content.js';

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
const Paras = ({ t }) => blocks(t).map((b, i) => <p className="reveal" key={i} style={{ whiteSpace: 'pre-line' }}>{b}</p>);
export function Programa() {
  const c = useContent();
  return <section className="wrap sec"><h2 className="reveal">Seja um afiliado Loanda!</h2><Paras t={c.afiliado_intro} />
    <h3 className="reveal">Como funciona?</h3>
    <div className="grid3">{pairs(c.como_funciona).map(([t, d], i) => <div className="panel reveal" key={i}><h3>{i + 1}. {t}</h3><p className="muted">{d}</p></div>)}</div>
    {c.quem_pode && <><h3 className="reveal">Quem pode participar?</h3><Paras t={c.quem_pode} /></>}
    {c.importante && <div className="panel reveal"><b>Importante</b><p>{c.importante}</p></div>}
    <div className="row"><Link className="btn" to="/entrar?modo=registo">Tornar-me afiliado</Link><Link className="btn ghost" to="/entrar">Aceder à minha conta</Link></div></section>;
}
export function Sobre() {
  const c = useContent();
  return <section className="wrap sec"><h2 className="reveal">Sobre a Loanda Afiliados</h2><Paras t={c.sobre_text} />
    {c.missao && <><h3 className="reveal">A nossa missão</h3><p className="reveal">{c.missao}</p></>}
    {c.visao && <><h3 className="reveal">A nossa visão</h3><p className="reveal">{c.visao}</p></>}
    {c.valores && <><h3 className="reveal">Os nossos valores</h3><ul className="reveal">{lines(c.valores).map((x) => <li key={x}>{x}</li>)}</ul></>}</section>;
}
export function Faq() {
  const c = useContent();
  return <section className="wrap sec"><h2 className="reveal">Perguntas frequentes</h2>
    {blocks(c.faq).map((b, i) => { const [q, ...a] = b.split('\n'); return <details className="panel reveal" key={i}><summary><b>{q}</b></summary><p className="muted" style={{ whiteSpace: 'pre-line' }}>{a.join('\n')}</p></details>; })}</section>;
}
export default function Home() {
  const c = useContent();
  return <><section className="hero"><div className="wrap">
    <h1 className="reveal">{c.hero_title || 'Conhecimento, ferramentas e oportunidades para crescer.'}</h1>
    <p className="reveal">{c.hero_text}</p>
    <div className="row reveal"><a className="btn buy" href="#/produtos">Explorar produtos</a><Link className="btn ghost" to="/entrar?modo=registo">Tornar-me afiliado</Link></div></div></section>
    <section className="wrap sec"><Catalog /></section>
    <section className="wrap sec"><h2 className="reveal">O que encontra na nossa plataforma?</h2>
      <div className="grid">{pairs(c.categorias).map(([t, d]) => <div className="panel reveal" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>
    <div className="band"><section className="wrap sec"><h2 className="reveal">Porquê a Loanda Afiliados?</h2>
      <ul className="reveal">{lines(c.vantagens).map((x) => <li key={x}>{x}</li>)}</ul>
      <h3 className="reveal">Comece hoje!</h3><p className="reveal">{c.cta_text}</p>
      <div className="row"><Link className="btn" to="/entrar?modo=registo">Tornar-me afiliado</Link><Link className="btn ghost" to="/afiliados">Saber mais</Link></div></section></div></>;
}
