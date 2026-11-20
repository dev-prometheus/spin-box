import { useEffect, useRef, useState } from 'react';
import { SpeakerHighIcon, SpeakerSlashIcon, ArrowUpRightIcon, GiftIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/context/CurrencyContext';
import '@styles/components/WelcomeWheel.css';

const slices = ['RETRY', 'WIN', 'LOSE', 'RETRY', 'WIN', 'LOSE'];
const labels = { RETRY: 'TRY AGAIN', WIN: 'WELCOME', LOSE: 'LOSE' };
const messages = {
  RETRY: 'Try again. Your next welcome spin is free.',
  LOSE: 'No reward this visit. Come back later for another chance.',
};
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const FILLS = ['#ffcd57', '#ff7d32', '#fff2ce', '#ffd67f', '#ffd1bb', '#fff2ce'];
const INKS = Array(6).fill('#351706');
const progressKey = 'spinbox_welcome_visit_v2';
const returnAfterMs = 30 * 60 * 1000;
function initialVisit() {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey));
    if (saved?.id && (saved.outcome !== 'LOSE' || Date.now() - saved.finishedAt < returnAfterMs)) return saved;
  } catch { /* A new visit can still play. */ }
  return { id: crypto.randomUUID(), attempt: 1 };
}
function saveVisit(visit) {
  try { localStorage.setItem(progressKey, JSON.stringify(visit)); } catch { /* Storage is optional. */ }
}
function point(angle, radius) { const radians = angle * Math.PI / 180; return [250 + Math.cos(radians) * radius, 250 + Math.sin(radians) * radius]; }

export default function WelcomeWheel({ onClaim }) {
  const { formatMoney } = useCurrency();
  const [visit, setVisit] = useState(initialVisit);
  const [spinning, setSpinning] = useState(false);
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState(() => messages[visit.outcome] || 'No deposit needed for this welcome spin.');
  const disc = useRef(null);
  const angle = useRef(0);
  const frame = useRef(null);
  const locked = useRef(false);
  const audio = useRef(null);
  const soundEnabled = useRef(false);
  const mounted = useRef(true);
  const ready = visit.outcome === 'WIN';
  const lost = visit.outcome === 'LOSE';
  const reward = formatMoney(1);
  const shortReward = reward.replace(/\s[A-Z]{3}$/, '');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (frame.current) cancelAnimationFrame(frame.current);
      audio.current?.close().catch(() => {});
    };
  }, []);

  function tick() {
    if (!soundEnabled.current || !audio.current || audio.current.state !== 'running') return;
    const ctx = audio.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 680;
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.04);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled); soundEnabled.current = enabled;
    if (enabled) {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!audio.current || audio.current.state === 'closed') audio.current = new Audio();
        audio.current.resume().catch(() => {});
      } catch { /* Sound is optional. */ }
    }
  }
  async function spin() {
    if (locked.current || ready || lost) return;
    locked.current = true; setSpinning(true); setMessage('Spinning your free welcome wheel…');
    saveVisit(visit);
    let outcome;
    try {
      const response = await fetch(`${apiBase}/api/auth/welcome-spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visit.id, attempt: visit.attempt }),
      });
      const result = await response.json();
      if (!response.ok || !slices.includes(result.outcome)) throw new Error('Spin unavailable');
      outcome = result.outcome;
    } catch {
      if (mounted.current) {
        setMessage('We couldn’t load your spin. Try again in a moment.');
        setSpinning(false);
        locked.current = false;
      }
      return;
    }
    if (!mounted.current) return;
    const index = slices.indexOf(outcome);
    const current = angle.current;
    const base = -30 - index * 60;
    const difference = ((base - current) % 360 + 360) % 360;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = current + (reduced ? 0 : 1440) + difference;
    const duration = reduced ? 100 : 2900;
    let started;
    let lastTick = current;
    function animate(time) {
      if (!mounted.current) return;
      started ??= time;
      const progress = Math.min((time - started) / duration, 1);
      angle.current = reduced ? (progress === 1 ? target : current) : current + (target - current) * (1 - (1 - progress) ** 3);
      if (disc.current) disc.current.style.transform = `rotate(${angle.current}deg)`;
      if (!reduced && Math.abs(angle.current - lastTick) >= 60) { tick(); lastTick = angle.current; }
      if (progress < 1) { frame.current = requestAnimationFrame(animate); return; }
      const next = { ...visit, outcome, attempt: visit.attempt + 1, finishedAt: Date.now() };
      saveVisit(next);
      setVisit(next);
      setSpinning(false);
      locked.current = false;
      setMessage(messages[outcome] || '');
      if (outcome === 'WIN' && !reduced) confetti({ particleCount: 45, spread: 55, origin: { y: 0.55 }, colors: ['#ff7057', '#f1eee7', '#d0ddb0'], disableForReducedMotion: true });
    }
    frame.current = requestAnimationFrame(animate);
  }
  return (
    <section className={`welcome-game${ready ? ' welcome-game-ready' : ''}`} id="welcome-game" aria-labelledby="welcome-game-title">
      <div className="welcome-game-top"><span><GiftIcon size={17} /> New player welcome</span><button type="button" className="welcome-sound" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute wheel sound' : 'Enable wheel sound'}>{sound ? <SpeakerHighIcon size={19} /> : <SpeakerSlashIcon size={19} />}</button></div>
      <h2 id="welcome-game-title">{ready ? 'Your welcome reward' : 'Try your luck'}</h2>
      <div className="welcome-wheel-shell">
        <div className="welcome-wheel-pointer" aria-hidden="true" />
        <svg className="welcome-wheel-disc" ref={disc} viewBox="0 0 500 500" aria-hidden="true">
          <circle cx="250" cy="250" r="245" fill="#e05016" />
          {FILLS.map((fill, index) => {
            const start = -90 + index * 60; const end = start + 60;
            const a = point(start, 232); const b = point(end, 232); const mid = start + 30; const center = point(mid, 162);
            const label = labels[slices[index]];
            return <g key={index}><path d={`M250 250 L${a.join(' ')} A232 232 0 0 1 ${b.join(' ')} Z`} fill={fill} stroke="#fff8ed" strokeWidth="2" /><g transform={`translate(${center.join(' ')}) rotate(${mid + 90})`} fill={INKS[index]} textAnchor="middle" fontFamily="Outfit Variable, sans-serif" fontWeight="600"><text y={label === 'WELCOME' ? -8 : 5} fontSize="18">{label}</text>{label === 'WELCOME' && <text y="18" fontSize={shortReward.length > 14 ? 15 : 20}>{shortReward}</text>}</g></g>;
          })}
          <circle cx="250" cy="250" r="56" fill="#7c280c" stroke="#ffe1b7" strokeWidth="3" />
        </svg>
        <div className="welcome-wheel-hub" aria-hidden="true"><img src="/reveal-fold.svg" alt="" width="42" height="42" /></div>
      </div>
      <div className="welcome-reward-line"><span>{ready ? 'Ready to claim' : 'Welcome reward'}</span><strong>{reward}</strong></div>
      <p className="welcome-feedback" role="status" aria-live="polite">{ready ? 'Verify your email to claim your welcome reward.' : message}</p>
      {ready ? <button type="button" className="tsb-button welcome-spin-button" onClick={() => {
        try { localStorage.setItem('spinbox_welcome_claim_visit', visit.id); } catch { /* Auth can still open. */ }
        onClaim(visit.id);
      }}>Claim {reward} <ArrowUpRightIcon size={19} /></button> : !lost && <button type="button" className="tsb-button welcome-spin-button" onClick={spin} disabled={spinning}>{spinning ? 'Spinning…' : visit.outcome === 'RETRY' ? 'Try again for free' : 'Spin for free'}<ArrowClockwiseIcon size={20} /></button>}
      {ready && <p className="welcome-game-disclosure">For eligible new accounts. Use it on items worth up to {formatMoney(2)}.</p>}
    </section>
  );
}
