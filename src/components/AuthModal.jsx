import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, EnvelopeSimpleIcon, KeyholeIcon, XIcon } from '@phosphor-icons/react';
import Brand from '@components/Brand';
import { supabase } from '@services/supabaseClient';
import '@styles/components/AuthModal.css';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export default function AuthModal({ isOpen, onClose, welcomeVisit }) {
  return isOpen ? <AuthDialog onClose={onClose} welcomeVisit={welcomeVisit} /> : null;
}

function AuthDialog({ onClose, welcomeVisit }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState(() => welcomeVisit || readStorage('spinbox_welcome_claim_visit') ? 'email' : 'password');
  const [password, setPassword] = useState('');
  const codeStep = mode === 'code';
  const setup = mode === 'setup';
  const passwordSignIn = mode === 'password';
  const [pending, setPending] = useState('');
  const [feedback, setFeedback] = useState(null);
  const dialogRef = useRef(null);
  const fieldRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      requestRef.current?.abort();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
  }, [mode]);

  async function submit(action) {
    if (requestRef.current) return;
    const verify = action === 'verify';
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(action);
    setFeedback(null);
    try {
      if (action === 'password' || action === 'setup') {
        const { error } = action === 'setup'
          ? await supabase.auth.updateUser({ password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (controller.signal.aborted) return;
        if (error) {
          setFeedback({ error: true, message: action === 'setup'
            ? error.message
            : 'Couldn’t sign in. Check your email and password or use an email code.' });
          return;
        }
        onClose();
        return;
      }

      const body = {
        email: email.trim(),
        referrerId: readStorage('spinbox_referrer'),
      };
      if (verify) {
        body.token = code;
        body.welcomeVisit = welcomeVisit || readStorage('spinbox_welcome_claim_visit');
      }

      const response = await fetch(`${apiBase}/api/auth/${verify ? 'verify-otp' : 'send-otp'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        const message = response.status === 429
          ? result.error || 'Wait a moment before requesting another code.'
          : verify && response.status === 401
            ? 'That code is invalid or expired. Check it or request a new one.'
            : 'Something went wrong. Try again in a moment.';
        setFeedback({ error: true, message });
        return;
      }

      if (verify) {
        if (controller.signal.aborted) return;
        const { error } = await supabase.auth.verifyOtp({
          token_hash: result.data.tokenHash,
          type: 'magiclink',
        });
        if (error) {
          setFeedback({ error: true, message: 'We couldn’t finish signing you in. Request a new code and try again.' });
          return;
        }
        if (result.data.welcomeClaim) {
          try {
            localStorage.removeItem('spinbox_welcome_claim_visit');
            localStorage.removeItem('spinbox_welcome_visit_v2');
          } catch { /* Sign-in already succeeded. */ }
        }
        if (!controller.signal.aborted) {
          setPassword('');
          setMode('setup');
        }
        return;
      }

      setEmail(body.email);
      setCode('');
      setMode('code');
      if (action === 'resend') {
        setFeedback({ error: false, message: 'New code sent. Use the most recent email.' });
        fieldRef.current?.focus({ preventScroll: true });
      }
    } catch {
      if (!controller.signal.aborted) {
        setFeedback({ error: true, message: 'We couldn’t complete that request. Try again in a moment.' });
      }
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setPending('');
    }
  }

  function changeMode(next) {
    setCode('');
    setPassword('');
    setFeedback(null);
    setMode(next);
  }

  const title = setup ? 'Set a password' : codeStep ? 'Check your inbox' : 'Sign in';
  const Illustration = codeStep || setup || passwordSignIn ? KeyholeIcon : EnvelopeSimpleIcon;

  return (
    <dialog
      className="tsb-auth-dialog"
      ref={dialogRef}
      aria-labelledby="auth-dialog-title"
      aria-describedby="auth-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <div className="tsb-auth-layout">
        <aside className="tsb-auth-ticket" aria-hidden="true">
          <Brand />
          <div className="tsb-auth-art"><Illustration size={78} weight="light" /></div>
          <div className="tsb-auth-ticket-footer"><span>{setup ? 'Password setup' : 'Account access'}</span></div>
        </aside>

        <div className="tsb-auth-content">
          <div className="tsb-auth-top">
            <p>{setup ? 'Email verified' : 'TemuSpinBox account'}</p>
            <button type="button" className="tsb-auth-close" onClick={onClose} disabled={Boolean(pending)} aria-label="Close sign-in">
              <XIcon size={20} />
            </button>
          </div>
          <h2 id="auth-dialog-title">{title}</h2>
          <p id="auth-dialog-description" className="tsb-auth-description">
            {setup ? 'Use this password next time you sign in.' : codeStep
              ? <>Enter the six-digit code we sent to <strong>{email}</strong>.</>
              : passwordSignIn ? 'Sign in with your email and password.' : 'We’ll send you a one-time code to continue.'}
          </p>

          <form onSubmit={(event) => {
            event.preventDefault();
            void submit(setup ? 'setup' : passwordSignIn ? 'password' : codeStep ? 'verify' : 'send');
          }}>
            {!setup && <><label htmlFor="auth-field">{codeStep ? 'Verification code' : 'Email address'}</label>
            {codeStep ? (
              <input
                key="code"
                ref={fieldRef}
                id="auth-field"
                className="tsb-auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="000000"
                value={code}
                readOnly={Boolean(pending)}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              />
            ) : (
              <input
                key="email"
                ref={fieldRef}
                id="auth-field"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                readOnly={Boolean(pending)}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}</>}

            {(setup || passwordSignIn) && <>
              <label htmlFor="auth-password">{setup ? 'New password' : 'Password'}</label>
              <input id="auth-password" ref={setup ? fieldRef : undefined} type="password"
                autoComplete={setup ? 'new-password' : 'current-password'}
                minLength={setup ? 8 : undefined} required readOnly={Boolean(pending)}
                value={password} onChange={(event) => setPassword(event.target.value)} />
              {setup && <p className="tsb-auth-description">Use at least 8 characters.</p>}
            </>}

            {feedback && (
              <p className={feedback.error ? 'tsb-auth-feedback is-error' : 'tsb-auth-feedback'} role={feedback.error ? 'alert' : 'status'}>
                {feedback.message}
              </p>
            )}

            <button className="tsb-auth-submit" type="submit" disabled={Boolean(pending) || (codeStep && code.length !== 6)}>
              {pending ? 'Please wait…' : setup ? 'Save password' : passwordSignIn ? 'Sign in' : codeStep ? 'Verify and continue' : 'Send sign-in code'}
              <ArrowRightIcon size={18} />
            </button>
          </form>

          {!codeStep && <div className="tsb-auth-recovery">
            {setup ? <button type="button" disabled={Boolean(pending)} onClick={onClose}>Skip for now</button>
              : passwordSignIn ? <button type="button" disabled={Boolean(pending)} onClick={() => changeMode('email')}>Use an email code or reset password</button>
                : <button type="button" disabled={Boolean(pending)} onClick={() => changeMode('password')}>Sign in with a password</button>}
          </div>}

          {codeStep && (
            <div className="tsb-auth-recovery">
              <button type="button" disabled={Boolean(pending)} onClick={() => changeMode('email')}><ArrowLeftIcon size={15} /> Change email</button>
              <button type="button" disabled={Boolean(pending)} onClick={() => void submit('resend')}>
                {pending === 'resend' ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
