/**
 * @file
 * This serviceworker file handles caching of the webapp.
 * It is pretty basic and has a lot of shortcomings, but it sure works :).
 *
 * When it is installed, it saves a copy of each file in `source` in a cache,
 * after which it completely stops using the internet, and just uses the cached files.
 * This allows the app to work on offline/bad connections.
 *
 * Then every time the app is opened again, the browser automatically checks if a new
 * serviceworker is available. If there is, then the new serviceworker is installed,
 * and it will in turn save a complete cache of the new files in the project.
 *
 * To make sure that there is a "new" serviceworker each time the project is updated,
 * we add a hash in the `currentCacheName` which is generated based on all the data in
 * the entire `source` folder. That way, if even a single character is changed, it
 * also change the contents of the serviceworker and thus makes it a "new" one that
 * the browser must download and install.
 *
 * The two first variables are inserted when `npm run build` is activated, and are
 * handled in the `build.js` file.
 */

const currentCacheName = "!build_insert_hash!";
const urlsToCache = "!build_insert_map!";

// When the serviceworker has just been downloaded and installed,
// open a new cache and save all files in the app to that cache.
self.addEventListener("install", event => {
	event.waitUntil(
		caches.open(currentCacheName).then((cache) => {
			return cache.addAll(urlsToCache);
		}).catch(error => {
			console.error(`SW failed to install: could not load cache ${currentCacheName}`, error);
		}),
	);
});

// When the serviceworker is activated (taking over for an older serviceworker),
// make sure to delete any old caches that are lying around and using disk space.
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
			console.warn(`SW could not remove legacy cache`, error);
		}),
	);
});

// Whenever the app/browser tries to fetch a file, check whether it is in the cache
// (it should always be in the cache), and if it is, deliver the cached version
// instead of downloading it from the network. If no cached version is available,
// then use the network like a normal website would.
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
			console.error(`SW failed to fetch resource`, error);
		}),
	);
});
