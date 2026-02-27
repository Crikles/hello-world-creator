/* ═══════════════════════════════════════════════════════════
   Service Worker – Web Push Notifications
   Logística JL Transportes
   ═══════════════════════════════════════════════════════════ */

// Listen for push events from the server
self.addEventListener('push', (event) => {
    let data = { title: 'Logística JL Transportes', body: 'Você tem uma atualização!' };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        // If data isn't JSON, use the text as body
        if (event.data) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || '',
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        image: data.image || undefined,
        data: {
            url: data.url || '/',
        },
        vibrate: [200, 100, 200],
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Logística JL Transportes', options)
    );
});

// When the user clicks on the notification, open the URL
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a window is already open, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(targetUrl);
                    return;
                }
            }
            // Otherwise open a new window
            return clients.openWindow(targetUrl);
        })
    );
});

// Activate the service worker immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});
