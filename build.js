/**
 * @file
 * This script generates a minified version of the site, ready for production.
 */


import path from "path";
import { fileURLToPath } from "url";
const site_root = path.dirname(fileURLToPath(import.meta.url));

import fs from "fs-extra";
import { hashElement as hashFolder } from "folder-hash";
import { minify as minifier } from "minify";

const minifier_options = {
	js: {
		"module": true,
		"ecma": 2022,
	},
	img: {
		maxSize: 512,
	},
};

const mainOutput = "/public";

const copy = [
	{
		"from": "/source",
		"to": "/public",
	},
];

const remove = [
	"/public/fonts/Space Mono/LICENSE",
];

const minify = [
	"/public",
	"/public/scripts",
	"/public/images",
];


for(const command of copy){
	console.log(`Copying ${path.join(command.from)} to ${path.join(command.to)}`);
	fs.removeSync(path.join(site_root, command.to));
	fs.copySync(path.join(site_root, command.from), path.join(site_root, command.to));
}

console.log("Setting production flag in main.js");
const main_path = path.join(site_root, mainOutput, "scripts/main.js");
fs.writeFileSync(
	main_path,
	fs.readFileSync(main_path, "utf-8")
		.replace("const isProduction = false;", "const isProduction = true;"),
);

for(const mount of remove){
	console.log(`Removing ${path.join(mount)}`);
	fs.removeSync(path.join(site_root, mount));
}

for(const mount of minify){
	const files = [];
	if(!fs.existsSync(path.join(site_root, mount))){
		console.warn(`${path.join(mount)} does not exist, cannot minify`);
		continue;
	}else if(fs.lstatSync(path.join(site_root, mount)).isFile()){
		files.push(mount);
	}else if(fs.lstatSync(path.join(site_root, mount)).isDirectory()){
		for(const file of fs.readdirSync(path.join(site_root, mount))){
			files.push(path.join(mount, file));
		}
	}else{
		continue;
	}
	for(const file of files){
		const ext = path.extname(file).toLowerCase();
		if([".html", ".css", ".js"].includes(ext)){
			console.log(`Minifying ${path.join(file)}`);
			minifier(path.join(site_root, file), minifier_options).then(minified => {
				return fs.writeFileSync(path.join(site_root, file), minified);
			}).catch(error => {
				console.error(error);
			});
		}else if(ext === ".json"){
			console.log(`Minifying ${path.join(file)}`);
			fs.writeFileSync(path.join(site_root, file), JSON.stringify(JSON.parse(fs.readFileSync(path.join(site_root, file)))));
		}
	}
}

console.log(`Preparing serviceworker`);

const map = await hashFolder(path.join(site_root, mainOutput));

const structure = generateFolderStructure(map.children);
/**
 * @param map
 * @param prefix
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
structure.push("/");

const sw_path = path.join(site_root, mainOutput, "serviceworker.js");
fs.writeFileSync(
	sw_path,
	fs.readFileSync(sw_path, "utf-8")
		.replaceAll("!build_insert_hash!", `cache-${map.hash}`)
		.replaceAll("\"!build_insert_map!\"", JSON.stringify(structure)),
);

