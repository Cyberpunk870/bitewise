// Firebase Messaging Service Worker
// Loaded by the browser (not bundled). Keep it lean and self-contained.
// Version: v2

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyCoEVDMs_3mPfMKWu3rib6r0n96LvJ-TCc',
  authDomain: 'bitewise-93.firebaseapp.com',
  projectId: 'bitewise-93',
  messagingSenderId: '989322472496',
  appId: '1:989322472496:web:466ef8a4805d9bb3c191f5',
  measurementId: 'G-2VS2VYE3RD',
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload?.notification || {};
  const title = notification.title || 'BiteWise';
  const options = {
    body: notification.body || 'You have a new update!',
    icon: '/icons/icon-192.png',
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});
