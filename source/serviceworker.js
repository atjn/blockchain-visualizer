/**
 * @file
 * This serviceworker file handles caching of the webapp.
 * It is pretty basic and has a lot of shortcomings, but it sure works :)
 */

const currentCacheName = "!build_insert_hash!";
const urlsToCache = "!build_insert_map!";

self.addEventListener("install", event => {
	event.waitUntil(
		caches.open(currentCacheName).then((cache) => {
			return cache.addAll(urlsToCache);
		}).catch(error => {
			console.error(`SW failed to install: could not load cache ${currentCacheName}: ${error}`);
		}),
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if(currentCacheName !== cacheName){
						return caches.delete(cacheName);
					}
				}),
			);
		}).catch(error => {
			console.warn(`SW could not remove legacy cache: ${error}`);
		}),
	);
});

self.addEventListener("fetch", event => {
	event.respondWith(
		caches.match(
			event.request,
			{ ignoreSearch: true },
		).then(response => {
			if(response){
				return response;
			}
			return fetch(event.request);
		}).catch(error => {
			console.error(`SW failed to fetch resource: ${error}`);
		}),
	);
});
