/**
 * @file
 * Currently, this file only registers the servicerworker.
 */

//isProduction is changed by the build script when building for production
const isProduction = false;

if(isProduction && window.location.pathname.length < 2){
	navigator.serviceWorker?.register("serviceworker.js", { type: "module" });
}
