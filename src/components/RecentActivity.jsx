import { useEffect, useState } from 'react';
import { TrophyIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import { supabase } from '@services/supabaseClient';
import { useCurrency } from '@/context/CurrencyContext';
import '@styles/components/RecentActivity.css';

const nextRefresh = () => 25_000 + Math.random() * 65_000;

function sampleEvent(id) {
  const kind = Math.random() < 0.5 ? 'win' : 'cashout';
  const amountUsd = kind === 'win'
    ? 3 + Math.floor(Math.random() * 23)
    : 5 + Math.floor(Math.random() * 46);

  return { id: `demo-${id}`, kind, amountUsd };
}

export default function RecentActivity() {
  const { formatMoney } = useCurrency();
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading');
  const [notice, setNotice] = useState(null);
  const [demoEvents, setDemoEvents] = useState(() => [0, 1, 2].map(sampleEvent));
  const [demoNotice, setDemoNotice] = useState(null);
  const isDemo = status === 'ready' && events.length === 0;
  const visibleNotice = isDemo ? demoNotice : status === 'ready' ? notice : null;
  const visibleEvents = isDemo ? demoEvents : events;

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let initialized = false;
    let previousIds = new Set();

    async function refresh() {
      if (!document.hidden) {
        try {
          const { data, error } = await supabase.rpc('get_recent_activity')
            .abortSignal(controller.signal);
          if (controller.signal.aborted) return;
          if (error || !Array.isArray(data)) throw new Error('Activity unavailable');

          const incoming = data.filter(({ id, kind, amountUsd }) =>
            typeof id === 'string' && (kind === 'win' || kind === 'cashout') &&
            Number.isFinite(amountUsd) && amountUsd > 0);
          const latest = initialized && incoming.find(({ id }) => !previousIds.has(id));
          setEvents(incoming);
          setStatus('ready');
          if (latest) setNotice(latest);
          if (incoming.length === 0) setNotice(null);
          else setDemoNotice(null);
          previousIds = new Set(incoming.map(({ id }) => id));
          initialized = true;
        } catch {
          if (controller.signal.aborted) return;
          setStatus('error');
          setNotice(null);
          setDemoNotice(null);
        }
      }
      timer = setTimeout(refresh, nextRefresh());
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isDemo) return undefined;
    let timer;

    function schedule() {
      timer = setTimeout(() => {
        if (!document.hidden) {
          const event = sampleEvent(crypto.randomUUID());
          setDemoEvents((previous) => [event, ...previous].slice(0, 3));
          setDemoNotice(event);
        }
        schedule();
      }, 8_000 + Math.random() * 17_000);
    }

    schedule();
    return () => clearTimeout(timer);
  }, [isDemo]);

  useEffect(() => {
    if (!demoNotice) return undefined;
    const timer = setTimeout(() => setDemoNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [demoNotice]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  function describe({ kind, amountUsd }) {
    const amount = formatMoney(amountUsd);
    return kind === 'win' ? `Won an item worth ${amount}` : `Cashed out ${amount}`;
  }

  return (
    <section className="tsb-recent" aria-labelledby="recent-activity-title">
      <header>
        <h2 id="recent-activity-title">Recent activity</h2>
        <p>{isDemo ? 'Demo preview · Simulated wins and cash-outs' : 'Confirmed wins and cash-outs from the past 24 hours.'}</p>
      </header>
      <div className="tsb-recent-notice" role="status" aria-atomic="true">
        {visibleNotice && <span key={visibleNotice.id}>{isDemo ? 'Demo activity' : 'New activity'} · {describe(visibleNotice)}</span>}
      </div>
      {visibleNotice && <button type="button" className="tsb-recent-dismiss" onClick={() => isDemo ? setDemoNotice(null) : setNotice(null)} aria-label="Dismiss activity update"><XIcon size={18} /></button>}
      {status === 'loading' && <p>Checking recent activity…</p>}
      {status === 'error' && <p>Activity is temporarily unavailable. We’ll check again shortly.</p>}
      {status === 'ready' && (
        <ul>
          {visibleEvents.slice(0, 3).map((event) => (
            <li key={event.id}>
              {event.kind === 'win' ? <TrophyIcon size={20} aria-hidden="true" /> : <WalletIcon size={20} aria-hidden="true" />}
              {isDemo && <strong className="tsb-recent-demo-label">Demo</strong>}
              {describe(event)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
