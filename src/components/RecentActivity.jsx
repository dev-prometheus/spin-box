import { useEffect, useState } from 'react';
import { TrophyIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import { supabase } from '@services/supabaseClient';
import { useCurrency } from '@/context/CurrencyContext';
import '@styles/components/RecentActivity.css';

function localActivity() {
  const kind = Math.random() < 0.5 ? 'win' : 'cashout';
  const amountUsd = kind === 'win'
    ? 3 + Math.floor(Math.random() * 23)
    : 5 + Math.floor(Math.random() * 46);
  return { kind, amountUsd };
}

export default function RecentActivity({ dashboard = false }) {
  const { formatMoney } = useCurrency();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const useLocalActivity = import.meta.env.DEV &&
      ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    let timer;
    let previousIds;

    function scheduleLocal(first = false) {
      timer = setTimeout(() => {
        if (!document.hidden) setNotice(localActivity());
        scheduleLocal();
      }, first ? 1500 + Math.random() * 2000 : 8000 + Math.random() * 17000);
    }

    async function refreshConfirmed() {
      if (!document.hidden) {
        try {
          const { data, error } = await supabase.rpc('get_recent_activity')
            .abortSignal(controller.signal);
          if (controller.signal.aborted) return;
          if (!error && Array.isArray(data)) {
            const incoming = data.filter((event) =>
              typeof event?.id === 'string' && (event.kind === 'win' || event.kind === 'cashout') &&
              Number.isFinite(event.amountUsd) && event.amountUsd > 0);
            const next = previousIds && incoming.find(({ id }) => !previousIds.has(id));
            if (next) setNotice(next);
            previousIds = new Set(incoming.map(({ id }) => id));
          }
        } catch {
          // Leave the popup quiet and retry after a temporary fetch failure.
        }
      }
      if (!controller.signal.aborted) {
        timer = setTimeout(refreshConfirmed, 25_000 + Math.random() * 65_000);
      }
    }

    if (useLocalActivity) scheduleLocal(true);
    else void refreshConfirmed();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className={`tsb-activity-popup${dashboard ? ' tsb-activity-popup-dashboard' : ''}`}>
      <div role="status" aria-atomic="true">
        {notice && (
          <div className="tsb-activity-message">
            {notice.kind === 'win' ? <TrophyIcon size={22} aria-hidden="true" /> : <WalletIcon size={22} aria-hidden="true" />}
            <span>{notice.kind === 'win' ? 'Won an item worth' : 'Cashed out'} <strong>{formatMoney(notice.amountUsd)}</strong></span>
          </div>
        )}
      </div>
      {notice && (
        <button type="button" className="tsb-activity-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss activity update">
          <XIcon size={18} />
        </button>
      )}
    </div>
  );
}
