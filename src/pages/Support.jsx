import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import '@styles/pages/Support.css';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function Support({ email = '' }) {
  const lock = useRef(false);
  const heading = useRef(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const details = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`${apiBase}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'We couldn’t send your message. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('We couldn’t confirm your message was sent. Try again or email support directly.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="tsb-support" id="main-content">
      <div className="support-intro">
        <EnvelopeSimpleIcon size={27} aria-hidden="true" />
        <h1 ref={heading} tabIndex={-1}>Contact support</h1>
        <p>Need help with your account, wallet or prize? Tell us what happened.</p>
        <p>You can also email <a href="mailto:support@temuspinbox.com">support@temuspinbox.com</a>.</p>
      </div>
      {sent ? <div className="support-card" role="status">
        <h2>Message sent</h2>
        <p>We’ll reply to the email address you entered.</p>
        <button type="button" onClick={() => setSent(false)}>Send another message</button>
      </div> : <form className="support-card" onSubmit={submit}>
        <label>Your email<input name="email" type="email" autoComplete="email" defaultValue={email} maxLength={254} required /></label>
        <label>What do you need help with?
          <select name="topic" defaultValue="" required>
            <option value="" disabled>Choose a topic</option>
            <option value="account">Account and sign-in</option>
            <option value="wallet">Deposits and withdrawals</option>
            <option value="order">Prizes and delivery</option>
            <option value="rewards">Rewards and referrals</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <label>Order or withdrawal reference (optional)<input name="reference" maxLength={100} /></label>
        <label>Message<textarea name="message" rows={6} maxLength={3000} required /></label>
        <div hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <p>Leave out sign-in codes, passwords and wallet recovery phrases. <Link to="/legal?tab=privacy#support">Privacy policy</Link></p>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <ArrowRightIcon size={17} /></button>
      </form>}
    </main>
  );
}
