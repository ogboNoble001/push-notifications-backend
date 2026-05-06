require('dotenv').config();
const express  = require('express');
const webPush  = require('web-push');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── VAPID SETUP ─────────────────────────────────────────── */
webPush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'you@example.com'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* ─── MIDDLEWARE ──────────────────────────────────────────── */
app.use(express.json());

/* Serve all PWA static files from the same directory */
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    /* Service worker must not be cached by the browser */
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

/* ─── VAPID KEY GENERATOR (temp route — delete after use) ── */
/* Hit GET /generate-vapid once, copy the keys into your
   Render environment variables, then remove this route.      */
app.get('/generate-vapid', (req, res) => {
  const keys = webPush.generateVAPIDKeys();
  res.json({
    note: 'Copy these into your Render env vars, then delete this route!',
    VAPID_PUBLIC_KEY:  keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  });
});

/* ─── PUSH ROUTES ─────────────────────────────────────────── */

/* POST /api/push/subscribe
   Frontend sends the PushSubscription object after user opts in.
   In production: save this to your Supabase DB per user.
*/
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  /* TODO: save subscription to Supabase
     await supabase.from('push_subscriptions').upsert({
       user_id: req.user.id,
       subscription: JSON.stringify(subscription)
     });
  */

  console.log('[Push] New subscription:', subscription.endpoint);
  res.status(201).json({ message: 'Subscribed' });
});

/* POST /api/push/send
   Trigger a push notification (call this from your own logic
   or hit it manually to test — protect with auth in production).
*/
app.post('/api/push/send', async (req, res) => {
  const { subscription, title, body, data } = req.body;

  if (!subscription) {
    return res.status(400).json({ error: 'subscription required' });
  }

  const payload = JSON.stringify({ title, body, data });

  try {
    await webPush.sendNotification(subscription, payload);
    res.json({ message: 'Push sent' });
  } catch (err) {
    console.error('[Push] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── FALLBACK — SPA ─────────────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ─── START ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});
