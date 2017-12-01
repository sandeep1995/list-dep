#!/usr/bin/env node

const fs = require('fs');
const findVersions = require('find-versions');
const fetch = require('isomorphic-fetch');
const chalk = require('chalk');

const cyan = chalk.bold.cyan;
const red = chalk.bold.red;
const magenta = chalk.magenta;
const yellow = chalk.yellow;


const cache = new Set();
const visitedCache = new Map();

let num = 0;

const readPackage = (package_path) => {
	return new Promise((resolve, reject) => {
		fs.readFile(package_path, "utf-8", (err, data) => {
			if (err) {
				reject(err);
			}
			resolve(data);
		});
	})
};

const getLocalDependencies = (data) => {
	if (typeof data === "string") {
		return JSON.parse(data).dependencies;
	}
};


const getDetailsUrl = (package) => {
	if (package) {
		let [name, version] = package.split('&&');
		return `https://registry.npmjs.org/${name}/${version}`;
	}
}

const download = (package) => {
	let url = getDetailsUrl(package);
	fetch(url)
		.then(res => res.json())
		.then(data => {
			visitedCache.set(package, true);
			num++;

			let [name, version] = package.split('&&');
			console.log(`${yellow(num)} ${cyan(name)} => ${cyan(version)}`);
			if (data.dependencies) {
				return data.dependencies;
			}
		})
		.then(dependencies => {
			if (dependencies) {
				Object.keys(dependencies).forEach((val, i, arr) => {
					let version = findVersions(dependencies[val], {loose: true})[0];
					if (!version) {
						version = dependencies[val];
					}
					let packageName = `${val}&&${version}`;
					if (cache.add(packageName) && !visitedCache.get(packageName)) {
						download(packageName);
					}
				});
			}
		})
		.catch(e => console.log(red("Oops! Unable to fetch data")));
};


const startQueueing = () => {
	cache.forEach(package => {
		if (!visitedCache.get(package)) {
			download(package);
		}
	});
}

const addToCache = (dependencies) => {
	Object.keys(dependencies).forEach((val, i, arr) => {
		let version = findVersions(dependencies[val], {loose: true})[0];
		if (!version) {
			version = dependencies[val];
		}
		let packageName = `${val}&&${version}`;
		cache.add(packageName);
	});
}

const startProcess = () => {
	console.log(magenta("Listing all production dependencies of your project"));
	readPackage('package.json')
		.then(data => {
			let dependencies = getLocalDependencies(data);
			if (!dependencies) throw Error("Unable to find any packages")
			addToCache(dependencies);
			startQueueing();
		})
		.catch(err => {
			console.log(red("Oops! Either no production dependencies or not a NPM project."))
		});
};

startProcess();
