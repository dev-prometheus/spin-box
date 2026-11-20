import { Router } from 'express';
import { sendSupportEmail } from '../services/emailService.js';

const router = Router();
const topics = new Map([
  ['account', 'Account and sign-in'],
  ['wallet', 'Deposits and withdrawals'],
  ['order', 'Prizes and delivery'],
  ['rewards', 'Rewards and referrals'],
  ['other', 'Something else'],
]);
const windowMs = 15 * 60 * 1000;
let windowEnds = 0;
let attempts = 0;
const byEmail = new Map();

router.post('/', async (req, res) => {
  const body = req.body ?? {};
  if (body.website) return res.status(202).json({ success: true });

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const topic = topics.get(body.topic);
  if (email.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)
    || !topic || !message || message.length > 3000 || reference.length > 100 || /[\r\n]/.test(reference)) {
    return res.status(400).json({ success: false, error: 'Check your email, topic and message, then try again.' });
  }

  const now = Date.now();
  if (now >= windowEnds) {
    windowEnds = now + windowMs;
    attempts = 0;
    byEmail.clear();
  }
  const key = email.toLowerCase();
  const senderAttempts = byEmail.get(key) ?? 0;
  if (attempts >= 40 || senderAttempts >= 3) {
    res.set('Retry-After', String(Math.ceil((windowEnds - now) / 1000)));
    return res.status(429).json({ success: false, error: 'Too many requests. Wait a few minutes or email support directly.' });
  }
  attempts += 1;
  byEmail.set(key, senderAttempts + 1);

  try {
    await sendSupportEmail({ email, topic, reference, message });
    return res.status(202).json({ success: true });
  } catch (error) {
    console.error('[Support] Resend delivery request failed:', error.name);
    return res.status(502).json({ success: false, error: 'We couldn’t confirm your message was sent. Please try again or email support directly.' });
  }
});

export default router;
