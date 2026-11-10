import { useEffect, useState } from 'react';
import { sb } from '../supabase.js';
import { Modal, toast } from '../ui.jsx';

const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safe = (n) => n.replace(/[^a-zA-Z0-9._-]/g, '_');
const TABS = [['geral', 'Geral'], ['preco', 'Preço e stock'], ['imagens', 'Imagens'], ['ficheiros', 'Ficheiros'], ['curso', 'Curso']];

export default function ProductForm({ form: f, setForm, cats, onClose, onSaved }) {
  const [tab, setTab] = useState('geral'); const [busy, setBusy] = useState(false); const [files, setFiles] = useState([]);
  const set = (k) => (e) => setForm({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const gallery = f.gallery || [];
  const loadFiles = async () => { if (!f.id) return setFiles([]); const { data } = await sb.from('product_files').select('*').eq('product_id', f.id).order('created_at'); setFiles(data || []); };
  useEffect(() => { loadFiles(); }, [f.id]);

  const save = async (e) => {
    e?.preventDefault();
    if (!f.name) return toast('Escreva o nome do produto.', 'err');
    const row = { name: f.name, slug: f.slug || slugify(f.name), short_description: f.short_description, description: f.description, category_id: f.category_id || null, type: f.type, price_kz: Math.round(+f.price_kz || 0), commission_bp: Math.round((+f.pct || 0) * 100), is_published: !!f.is_published, is_available: f.is_available !== false, is_featured: !!f.is_featured, cover_url: f.cover_url || null, gallery, course_content: f.course_content || null, stock: f.stock === '' || f.stock == null ? null : +f.stock, published_at: f.is_published ? f.published_at || new Date().toISOString() : null };
    setBusy(true);
    const r = f.id ? await sb.from('products').update(row).eq('id', f.id).select('id').single() : await sb.from('products').insert(row).select('id').single();
    setBusy(false);
    if (r.error) { toast(r.error.message, 'err'); return null; }
    setForm({ ...f, id: r.data.id, slug: row.slug }); toast('Produto guardado.'); onSaved(); return r.data.id;
  };
  const upload = async (bucket, file, prefix = '') => {
    const path = `${prefix}${crypto.randomUUID()}-${safe(file.name)}`;
    const { error } = await sb.storage.from(bucket).upload(path, file); if (error) throw error; return path;
  };
  const pub = (p) => sb.storage.from('covers').getPublicUrl(p).data.publicUrl;
  const addCover = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; setBusy(true);
    try { setForm({ ...f, cover_url: pub(await upload('covers', file)) }); toast('Capa carregada. Toque em Guardar.'); } catch (x) { toast(x.message, 'err'); } setBusy(false); };
  const addGallery = async (e) => { const list = [...e.target.files]; e.target.value = ''; if (!list.length) return; setBusy(true);
    try { const urls = []; for (const file of list) urls.push(pub(await upload('covers', file, 'gal-'))); setForm({ ...f, gallery: [...gallery, ...urls] }); toast('Imagens carregadas. Toque em Guardar.'); } catch (x) { toast(x.message, 'err'); } setBusy(false); };
  const addFile = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (!f.id) return toast('Guarde o produto primeiro e depois envie os ficheiros.', 'err'); setBusy(true);
    try { const path = await upload('product-files', file, f.id + '/'); const { error } = await sb.from('product_files').insert({ product_id: f.id, storage_path: path, file_name: file.name, kind: 'digital' }); if (error) throw error; toast('Ficheiro enviado.'); loadFiles(); } catch (x) { toast(x.message, 'err'); } setBusy(false); };
  const rmFile = async (x) => { if (!window.confirm('Remover este ficheiro?')) return; await sb.storage.from('product-files').remove([x.storage_path]); await sb.from('product_files').delete().eq('id', x.id); loadFiles(); };
  const openFile = async (x) => { const { data, error } = await sb.storage.from('product-files').createSignedUrl(x.storage_path, 300); error ? toast(error.message, 'err') : window.open(data.signedUrl, '_blank'); };
  const L = (label, node) => <label>{label}{node}</label>;

  return <Modal title={f.id ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
    <div className="chips">{TABS.map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    <form className="form" onSubmit={save}>
      {tab === 'geral' && <>
        {L('Nome', <input required value={f.name || ''} onChange={set('name')} />)}
        {L('Endereço (slug, opcional)', <input value={f.slug || ''} onChange={set('slug')} />)}
        {L('Tipo', <select value={f.type} onChange={set('type')}>{['livro', 'curso', 'documento', 'planilha', 'fisico', 'outro'].map((t) => <option key={t}>{t}</option>)}</select>)}
        {L('Categoria', <select value={f.category_id || ''} onChange={set('category_id')}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        {L('Descrição curta', <input value={f.short_description || ''} onChange={set('short_description')} />)}
        {L('Descrição completa', <textarea rows="5" value={f.description || ''} onChange={set('description')} />)}
        {[['is_published', 'Publicado'], ['is_available', 'Disponível'], ['is_featured', 'Em destaque']].map(([k, l]) => <label className="chk" key={k}><input type="checkbox" checked={!!f[k]} onChange={set(k)} /> {l}</label>)}</>}
      {tab === 'preco' && <>
        {L('Preço (Kz)', <input type="number" min="0" required value={f.price_kz ?? 0} onChange={set('price_kz')} />)}
        {L('Comissão do afiliado (%)', <input type="number" min="0" max="100" step="0.01" required value={f.pct ?? 10} onChange={set('pct')} />)}
        {L('Quantidade em stock (produtos físicos)', <input type="number" min="0" value={f.stock ?? ''} onChange={set('stock')} />)}</>}
      {tab === 'imagens' && <>
        {L('Imagem de capa', <input type="file" accept="image/*" onChange={addCover} />)}
        {f.cover_url && <div className="cover" style={{ backgroundImage: `url(${f.cover_url})` }} />}
        {L('Galeria (pode escolher várias)', <input type="file" accept="image/*" multiple onChange={addGallery} />)}
        <div className="row">{gallery.map((u) => <div key={u} style={{ position: 'relative' }}><img src={u} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
          <button type="button" className="btn sm" style={{ position: 'absolute', top: 0, right: 0, padding: '0 6px' }} onClick={() => setForm({ ...f, gallery: gallery.filter((x) => x !== u) })}>×</button></div>)}</div>
        <p className="small muted">Depois de carregar ou remover imagens, toque em Guardar.</p></>}
      {tab === 'ficheiros' && <>
        <p className="small muted">Ficheiros digitais do produto (PDF, Word, Excel…). Ficam privados e só o administrador os abre.</p>
        {!f.id ? <p className="err">Guarde o produto primeiro para poder enviar ficheiros.</p> : <>
          {L('Enviar ficheiro', <input type="file" onChange={addFile} />)}
          {files.map((x) => <div className="panel row" key={x.id} style={{ alignItems: 'center', margin: 0 }}><span style={{ flex: 1, wordBreak: 'break-all' }}>{x.file_name}</span>
            <button type="button" className="btn sm ghost" onClick={() => openFile(x)}>Abrir</button><button type="button" className="btn sm ghost" onClick={() => rmFile(x)}>Remover</button></div>)}</>}</>}
      {tab === 'curso' && <>
        {L('Conteúdo / módulos do curso (um por linha)', <textarea rows="8" placeholder={'Módulo 1 - Introdução\nMódulo 2 - ...'} value={f.course_content || ''} onChange={set('course_content')} />)}
        <p className="small muted">Aparece na página do produto. Materiais do curso podem ser enviados no separador Ficheiros.</p></>}
      <button className="btn" disabled={busy}>{busy ? 'Aguarde…' : 'Guardar'}</button>
    </form></Modal>;
}
