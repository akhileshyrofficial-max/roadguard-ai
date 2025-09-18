/// <reference lib="webworker" />
// FIX: Removed redundant declaration of 'self'. The 'webworker' lib reference already defines it.
// declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'roadguard-ai-cache-v2'; // Bumped version to ensure new SW activates
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  // Core scripts
  '/index.tsx',
  '/App.tsx',
  // Components
  '/components/AnalysisDisplay.tsx',
  '/components/AreaHealthDisplay.tsx',
  '/components/CameraCapture.tsx',
  '/components/ErrorMessage.tsx',
  '/components/GisDashboard.tsx',
  '/components/Header.tsx',
  '/components/IconComponents.tsx',
  '/components/ImageUploader.tsx',
  '/components/OfflineBanner.tsx',
  '/components/RealTimeDetector.tsx',
  '/components/ResultCard.tsx',
  '/components/SatelliteAnalysis.tsx',
  '/components/SatelliteAnalysisDisplay.tsx',
  '/components/Spinner.tsx',
  '/components/VideoAnalysis.tsx',
  '/components/WelcomeScreen.tsx',
  // Services & Utils
  '/services/geminiService.ts',
  '/utils/exportUtils.ts',
  '/utils/fileUtils.ts',
  '/utils/gpxParser.ts',
  '/utils/locationUtils.ts',
  '/utils/validationUtils.ts',
  '/utils/xmlParser.ts',
  // App Logic & Types
  '/constants.ts',
  '/types.ts',
  // External CDNs
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://js.arcgis.com/4.29/esri/themes/dark/main.css',
  'https://aistudiocdn.com/@google/genai@^1.17.0',
  'https://aistudiocdn.com/react@^19.1.1',
  'https://aistudiocdn.com/react-dom@^19.1.1/client',
  'https://aistudiocdn.com/webworker@^0.8.4'
];

// The install event is fired when the service worker is first installed.
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell');
        // Add all the assets to the cache for offline access.
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error("Failed to cache resources during install:", err);
      })
  );
});

// The activate event is fired when the service worker is activated.
// This is a good place to clean up old caches.
self.addEventListener('activate', (event: ExtendableEvent) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// The fetch event is fired for every request the browser makes.
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    (async () => {
      const { request } = event;

      // For API calls and non-GET requests, bypass the cache and go directly to the network.
      if (request.method !== 'GET' || request.url.includes('generativelanguage.googleapis.com')) {
        return fetch(request);
      }
      
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      
      // If we have a response in the cache, serve it (cache-first).
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, fetch from the network.
      try {
        const networkResponse = await fetch(request);
        
        // If the fetch was successful, clone it and add it to the cache for next time.
        // We only cache successful responses to avoid caching errors.
        if (networkResponse && networkResponse.status === 200) {
          // We must clone the response to be able to cache it and return it.
          const responseToCache = networkResponse.clone();
          await cache.put(request, responseToCache);
        }
        
        return networkResponse;
      } catch (error) {
        console.error('Service worker fetch failed:', error);
        // This will be caught by the browser as a network failure.
        // A fallback page could be served here from the cache if available.
        throw error;
      }
    })()
  );
});