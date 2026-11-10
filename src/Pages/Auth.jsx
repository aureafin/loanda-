import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sb } from '../supabase.js';
import { Modal, toast } from '../ui.jsx';

export default function Auth() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const [reg, setReg] = useState(sp.get('modo') === 'registo'); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '', password2: '', province: '', municipality: '', holder: '', bank: '', iban: '', terms: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  useEffect(() => { sb.auth.getSession().then(async ({ data }) => { if (!data.session) return; const { data: adm } = await sb.from('admin_users').select('user_id').maybeSingle(); nav(adm ? '/admin' : '/conta'); }); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (reg) {
      if (f.password.length < 8) return toast('A palavra-passe deve ter pelo menos 8 caracteres.', 'err');
      if (f.password !== f.password2) return toast('As palavras-passe não coincidem.', 'err');
      if (!f.terms) return toast('Aceite os termos e condições.', 'err');
      if (f.iban.replace(/\s/g, '').length < 10) return toast('Número de conta/IBAN inválido.', 'err');
    }
    setBusy(true);
    if (reg) {
      const { password, password2, email, ...meta } = f;
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: meta } });
      setBusy(false);
      if (error) return toast(error.message, 'err');
      if (data.session) { toast('Conta criada com sucesso!'); nav('/conta'); } else setDone(true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password });
      setBusy(false);
      if (error) return toast('E-mail ou palavra-passe incorrectos.', 'err');
      const { data: adm } = await sb.from('admin_users').select('user_id').maybeSingle();
      nav(adm ? '/admin' : '/conta');
    }
  };
  const recover = async () => {
    if (!f.email) return toast('Escreva o seu e-mail primeiro.', 'err');
    const { error } = await sb.auth.resetPasswordForEmail(f.email, { redirectTo: location.origin + location.pathname });
    toast(error ? error.message : 'Enviámos um link de recuperação para o seu e-mail.', error ? 'err' : 'ok');
  };
  const I = (k, label, type = 'text', req = true) => <label>{label}<input type={type} required={req} value={f[k]} onChange={set(k)} /></label>;
  return <section className="wrap sec narrow"><h2>{reg ? 'Tornar-me afiliado' : 'Entrar'}</h2>
    <form className="panel form" onSubmit={submit}>
      {reg && <>{I('full_name', 'Nome completo')}{I('phone', 'Telefone', 'tel')}</>}
      {I('email', 'E-mail', 'email')}{I('password', 'Palavra-passe', 'password')}
      {reg && <>{I('password2', 'Confirmar palavra-passe', 'password')}{I('province', 'Província')}{I('municipality', 'Município')}
        {I('holder', 'Nome do titular da conta')}{I('bank', 'Banco')}{I('iban', 'Número de conta ou IBAN')}
        <label className="chk"><input type="checkbox" checked={f.terms} onChange={set('terms')} /> Aceito os <a href="#/legal" target="_blank">termos e condições</a></label></>}
      <button className="btn" disabled={busy}>{busy ? 'Aguarde…' : reg ? 'Criar conta' : 'Entrar'}</button>
      {!reg && <button type="button" className="link" onClick={recover}>Esqueci a palavra-passe</button>}
      <button type="button" className="link" onClick={() => setReg(!reg)}>{reg ? 'Já tenho conta' : 'Quero ser afiliado'}</button>
    </form>
    {done && <Modal title="Conta criada com sucesso ✅" onClose={() => { setDone(false); setReg(false); }}>
      <p>Enviámos um e-mail de confirmação para <b>{f.email}</b>.</p>
      <p>Abra o e-mail, toque no link de confirmação e depois volte aqui para <b>entrar</b>. Se não o encontrar, veja também a pasta de spam.</p>
      <button className="btn buy block" onClick={() => { setDone(false); setReg(false); }}>Entendi</button></Modal>}
  </section>;
}
