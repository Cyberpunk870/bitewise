// /public/firebase-messaging-sw.js  (classic SW, not module)

// Load compat builds so we can use importScripts + older SW pattern
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// --- REQUIRED: your web app config (safe to be public in SW) ---
firebase.initializeApp({
  apiKey: 'AIzaSyCoEVDMs_3mPfMKWu3rib6r0n96LvJ-TCc',
  appId: '1:989322472496:web:466ef8a4805d9bb3c191f5',
  projectId: 'bitewise-93',
  messagingSenderId: '989322472496',
});

const messaging = firebase.messaging();

// Ensure the newest SW takes control quickly
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  clients.claim();
});

// Optional: background notifications
messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) || 'BiteWise';
  const options = {
    body: (payload.notification && payload.notification.body) || 'New update',
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
