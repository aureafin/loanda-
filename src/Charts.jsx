import { Modal } from './ui.jsx';
const COLORS = ['#C49A4A', '#E8DDC8', '#912D1C', '#8FA58B', '#6B7A8F'];
const W = 320, H = 190, PL = 38, PR = 12, PT = 14, PB = 28;
export const short = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'k' : v);
export const byDay = (rows, n, val = () => 1) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); const e = new Date(d); e.setDate(e.getDate() + 1);
  return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: rows.filter((r) => { const t = new Date(r.created_at); return t >= d && t < e; }).reduce((a, r) => a + val(r), 0) };
});
export const cumul = (data) => { let s = 0; return data.map((x) => ({ ...x, value: (s += x.value) })); };
const Grid = ({ max }) => [0, 0.5, 1].map((t) => { const y = H - PB - t * (H - PB - PT); return <g key={t}><line x1={PL} x2={W - PR} y1={y} y2={y} stroke="rgba(232,221,200,.15)" /><text x={PL - 5} y={y + 3} fontSize="9" fill="#E8DDC8" textAnchor="end">{short(Math.round(max * t))}</text></g>; });
export function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1), bw = (W - PL - PR) / data.length, step = Math.ceil(data.length / 6);
  return <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"><Grid max={max} />
    {data.map((d, i) => { const h = (d.value / max) * (H - PB - PT); const x = PL + i * bw; return <g key={i}><rect x={x + bw * 0.15} y={H - PB - h} width={bw * 0.7} height={h} rx="2" fill="#C49A4A" />{i % step === 0 && <text x={x + bw / 2} y={H - 10} fontSize="9" fill="#E8DDC8" textAnchor="middle">{d.label}</text>}</g>; })}</svg>;
}
export function LineChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1), n = data.length, step = Math.ceil(n / 6);
  const X = (i) => PL + (n > 1 ? (i * (W - PL - PR)) / (n - 1) : (W - PL - PR) / 2), Y = (v) => H - PB - (v / max) * (H - PB - PT);
  const pts = data.map((d, i) => `${X(i)},${Y(d.value)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"><Grid max={max} />
    <polygon points={`${X(0)},${H - PB} ${pts} ${X(n - 1)},${H - PB}`} fill="rgba(196,154,74,.18)" /><polyline points={pts} fill="none" stroke="#C49A4A" strokeWidth="2" />
    {data.map((d, i) => <g key={i}><circle cx={X(i)} cy={Y(d.value)} r="2.5" fill="#C49A4A" />{i % step === 0 && <text x={X(i)} y={H - 10} fontSize="9" fill="#E8DDC8" textAnchor="middle">{d.label}</text>}</g>)}</svg>;
}
export function PieChart({ data, fmt = (v) => v }) {
  const items = data.filter((d) => d.value > 0), total = items.reduce((a, d) => a + d.value, 0), R = 70, C = 90; let a0 = -Math.PI / 2;
  const slices = items.map((d, i) => { const a1 = a0 + (d.value / total) * 2 * Math.PI; const pt = (a) => `${C + R * Math.cos(a)} ${C + R * Math.sin(a)}`;
    const path = `M${C} ${C} L${pt(a0)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`; a0 = a1; return { ...d, path, color: COLORS[i % COLORS.length] }; });
  return <><svg viewBox="0 0 180 180" className="chart" style={{ maxWidth: 220, margin: '0 auto' }} role="img">
    {slices.length === 1 ? <circle cx={C} cy={C} r={R} fill={slices[0].color} /> : slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#20241f" strokeWidth="1.5" />)}</svg>
    <ul className="legend">{slices.map((s) => <li key={s.label}><span className="dot" style={{ background: s.color }} />{s.label}<b>{fmt(s.value)} · {Math.round((s.value / total) * 100)}%</b></li>)}</ul></>;
}
export function ChartModal({ title, type, data, fmt, onClose }) {
  const empty = !data.some((d) => d.value > 0);
  return <Modal title={title} onClose={onClose}>
    {empty ? <p className="muted">Ainda não há dados para este período.</p> : type === 'bar' ? <BarChart data={data} /> : type === 'line' ? <LineChart data={data} /> : <PieChart data={data} fmt={fmt} />}
    <button className="btn ghost block" onClick={onClose}>Fechar</button></Modal>;
}
