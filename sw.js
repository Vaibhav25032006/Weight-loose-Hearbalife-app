/* ============================================================
   Smart Wellness Studio — Service Worker
   Handles background scheduled notifications using
   periodic check via setInterval stored alarm logic.
   ============================================================ */

const CACHE_NAME = 'hb-wellness-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

/* ---- Listen for messages from the main app ---- */
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { time, freq, days, label } = e.data;
    // Store schedule in SW scope
    self._notifSchedule = { time, freq, days, label };
    startNotifLoop();
  }

  if (e.data.type === 'CANCEL_NOTIFICATION') {
    self._notifSchedule = null;
    if (self._notifLoopId) {
      clearInterval(self._notifLoopId);
      self._notifLoopId = null;
    }
  }

  if (e.data.type === 'TEST_NOTIFICATION') {
    showNotification('Smart Wellness Studio 💪', {
      body: e.data.body || 'Reminder set successfully! You will be notified at your chosen time.',
    });
  }
});

/* ---- Push event (for real push, if server sends) ---- */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    showNotification(data.title || 'Smart Wellness Studio', {
      body: data.body || 'Time for your workout!',
    })
  );
});

/* ---- Notification click ---- */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url && c.focus) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

/* ---- Core: check every minute if it's time to notify ---- */
function startNotifLoop() {
  if (self._notifLoopId) clearInterval(self._notifLoopId);
  self._lastNotifDate = null;

  self._notifLoopId = setInterval(() => {
    const schedule = self._notifSchedule;
    if (!schedule) return;

    const now = new Date();
    const todayKey = now.toDateString();
    const [hh, mm] = (schedule.time || '08:00').split(':').map(Number);

    const isRightTime = now.getHours() === hh && now.getMinutes() === mm;
    const alreadyDoneToday = self._lastNotifDate === todayKey;

    // Day-of-week check
    const dow = now.getDay(); // 0=Sun
    let shouldNotifyDay = false;
    if (schedule.freq === 'daily') {
      shouldNotifyDay = true;
    } else if (schedule.freq === 'weekdays') {
      shouldNotifyDay = dow >= 1 && dow <= 5;
    } else if (schedule.freq === 'custom') {
      shouldNotifyDay = (schedule.days || []).includes(dow);
    }

    if (isRightTime && shouldNotifyDay && !alreadyDoneToday) {
      self._lastNotifDate = todayKey;
      showNotification('Smart Wellness Studio 💪', {
        body: "Time for today's workout! Keep your streak alive 🔥",
        tag: 'hb-daily-reminder',
        renotify: true,
      });
    }
  }, 60 * 1000); // check every 60 seconds
}

function showNotification(title, options) {
  return self.registration.showNotification(title, {
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Herbalife_logo.svg/120px-Herbalife_logo.svg.png',
    badge: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Herbalife_logo.svg/120px-Herbalife_logo.svg.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options,
  });
}
