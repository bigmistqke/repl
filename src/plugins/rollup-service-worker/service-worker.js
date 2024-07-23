/// <reference lib="WebWorker" />

const CACHE_NAME = 'esm-cache-v1' // Update this version to invalidate the cache
const ESM_SH_REGEX = /^https:\/\/esm.sh\//

self.addEventListener('install', event => {
  console.log('install')
  event.waitUntil(caches.open(CACHE_NAME))
})

self.addEventListener('activate', event => {
  console.log('activate')
  // Remove old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            return cacheName !== CACHE_NAME
          })
          .map(cacheName => {
            return caches.delete(cacheName)
          }),
      )
    }),
  )
})

self.addEventListener('fetch', event => {
  if (event.request.url.match(ESM_SH_REGEX)) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response // Return cached response if found
        }

        return fetch(event.request).then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone()) // Cache the new response
            return fetchResponse // Return the fetched response
          })
        })
      }),
    )
  } else {
    event.respondWith(fetch(event.request)) // Normal fetch for non-esm.sh requests
  }
})
