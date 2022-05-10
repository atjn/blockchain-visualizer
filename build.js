/**
 * @file
 * This script generates a slightly altered version of the project that is more
 * suited for use in production.
 * It minifies all JS, HTML, CSS, JSON files to make them download and run faster.
 * It also generates a serviceworker that is aware of all files that are in the project,
 * which means the serviceworker automatically gets replaced when, and only when,
 * there are changes to any files that warrant a new serviceworker with a new offline
 * store of files.
 *
 * You can run this file with `npm build`, and it will generate the minified version
 * in `/public`, based on the contents in `/source`.
 *
 * - Minification is mostly just using the `minify` NPM package.
 * - The serviceworker implementation is our own little special sauce.
 */


import path from "path";
import { fileURLToPath } from "url";
const site_root = path.dirname(fileURLToPath(import.meta.url));

import fs from "fs-extra";
import { hashElement as hashFolder } from "folder-hash";
import { minify as minifier } from "minify";

// Options for the minify package: https://github.com/coderaiser/minify#options
const minifier_options = {
	js: {
		"module": true,
		"ecma": 2022,
	},
	img: {
		maxSize: 512,
	},
};

// The path of the folder that the built version is in
const mainOutput = "/public";

// This tells the app to first copy the contents of `/source/` into `/public`
const copy = [
	{
		"from": "/source",
		"to": "/public",
	},
];

// Path to any files/folders that should be completely deleted during the minification
const remove = [
	"/public/fonts/Space Mono/LICENSE",
];

// Path to any files or folders containing files that should be minified
const minify = [
	"/public",
	"/public/scripts",
	"/public/images",
];

// Runs each copy command defined in the `copy` array.
for(const command of copy){
	console.log(`Copying ${path.join(command.from)} to ${path.join(command.to)}`);
	fs.removeSync(path.join(site_root, command.to));
	fs.copySync(path.join(site_root, command.from), path.join(site_root, command.to));
}

/**
 * Tells the code that it is now running in production mode.
 *
 * This will make the code register the serviceworker, which saves the app for offline use.
 * Offline save is a nice feature for the end-user, but a pain in the a$$ when you're rapidly
 * developing and want the app to update instantly, and therefore the serviceworker is
 * disabled when not in production mode.
 */
console.log("Setting production flag in main.js");
const main_path = path.join(site_root, mainOutput, "scripts/main.js");
fs.writeFileSync(
	main_path,
	fs.readFileSync(main_path, "utf-8")
		.replace("const isProduction = false;", "const isProduction = true;"),
);

// Remove anything at the defined paths in the `remove` array.
for(const mount of remove){
	console.log(`Removing ${path.join(mount)}`);
	fs.removeSync(path.join(site_root, mount));
}

// Minify whatever is at the specified paths
for(const mount of minify){
	const files = [];

	if(!fs.existsSync(path.join(site_root, mount))){
		console.warn(`${path.join(mount)} does not exist, cannot minify`);
		continue;

	// If it's a single file, just add the single file to the array
	}else if(fs.lstatSync(path.join(site_root, mount)).isFile()){
		files.push(mount);

	// If it's a folder, add each file in the folder to the array
	}else if(fs.lstatSync(path.join(site_root, mount)).isDirectory()){
		for(const file of fs.readdirSync(path.join(site_root, mount))){
			files.push(path.join(mount, file));
		}

	}else{
		continue;
	}

	// Now minify every file defined in the array
	for(const file of files){

		// Get the extension name to figure out how to minify it
		const ext = path.extname(file).toLowerCase();

		// Use the `minify` package to minify most web stuff
		if([".html", ".css", ".js"].includes(ext)){
			console.log(`Minifying ${path.join(file)}`);
			minifier(path.join(site_root, file), minifier_options).then(minified => {
				return fs.writeFileSync(path.join(site_root, file), minified);
			}).catch(error => {
				console.error(error);
			});

		// If the file is a JSON, simply parse the files and write it with `JSON.stringify`,
		// which outputs minified strings by default.
		}else if(ext === ".json"){
			console.log(`Minifying ${path.join(file)}`);
			fs.writeFileSync(path.join(site_root, file), JSON.stringify(JSON.parse(fs.readFileSync(path.join(site_root, file)))));
		}
	}
}


// Serviceworker stuff
console.log(`Preparing serviceworker`);

// Generates a map of all files, and a hash of the entire project.
// If even the slightest detail changes in the project, the hash will
// also change, which means the browser will download the new version
// of the serviceworker which has the new hash, and thus the new serviceworker
// will download new versions of all the project files
const map = await hashFolder(path.join(site_root, mainOutput));

/**
 * Generates a list of paths to every file in the project. This is used by the
 * serviceworker to save every file for offline use in the future.
 *
 * This is a recursive function that uses the map generated from the
 * `folder-hash` package to save the path for each file.
 *
 * @param {object[]} map - The map generated by the `folder-hash` package.
 * @param {string} prefix - A prefix to add to each generated path.
 *
 * @returns {string[]} - A list of paths to all files in that folder.
 */
function generateFolderStructure(map, prefix = ""){
	const structure = [];
	for(const element of map){
		const fullPath = path.join(prefix, element.name);
		if(element.children){
			structure.push(...generateFolderStructure(element.children, fullPath));
		}else if(!fullPath.endsWith("serviceworker.js")){
			structure.push(fullPath);
		}
	}
	return structure;
}
const structure = generateFolderStructure(map.children);
structure.push("/");

// Now add the hash and the file map to the servcieworker
const sw_path = path.join(site_root, mainOutput, "serviceworker.js");
fs.writeFileSync(
	sw_path,
	fs.readFileSync(sw_path, "utf-8")
		.replaceAll("!build_insert_hash!", `cache-${map.hash}`)
		.replaceAll("\"!build_insert_map!\"", JSON.stringify(structure)),
);

