require('dotenv').config();
const cors = require('cors');
const express  = require('express');
const webPush  = require('web-push');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── VAPID SETUP ─────────────────────────────────────────── */
/* Only configure if keys exist — server boots fine without them.
   Hit /generate-vapid first, then add keys to Render env vars. */
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'you@example.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('[Push] VAPID configured ✓');
} else {
  console.warn('[Push] VAPID keys not set — hit /generate-vapid to get them');
}

/* ─── MIDDLEWARE ──────────────────────────────────────────── */
app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());



/* ─── VAPID KEY GENERATOR (temp route — delete after use) ── */
app.get('/generate-vapid', (req, res) => {
  const keys = webPush.generateVAPIDKeys();
  res.json({
    note: 'Copy these into your Render env vars, then delete this route!',
    VAPID_PUBLIC_KEY:  keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  });
});

/* ─── PUSH ROUTES ─────────────────────────────────────────── */
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  /* TODO: save to Supabase per user */
  console.log('[Push] New subscription:', subscription.endpoint);
  res.status(201).json({ message: 'Subscribed' });
});

app.post('/api/push/send', async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'VAPID keys not configured yet' });
  }
  const { subscription, title, body, data } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });

  try {
    await webPush.sendNotification(subscription, JSON.stringify({ title, body, data }));
    res.json({ message: 'Push sent' });
  } catch (err) {
    console.error('[Push] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── FALLBACK — SPA ─────────────────────────────────────── */

/* ─── START ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});
