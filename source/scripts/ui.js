/**
 * @file
 * This file is the main handler for all UI elements in the app. Most of the direct changes to DOM elements should happen in this file.
 * All of the underlying simulation functionality of the app is imported into this file from other files.
 */

import { Simulation, SimulationTime, EventDispatcher, EventDrawer } from "./simulationHandlers.js";

/**.
 * This is a JSON representation of all the different inputs that the simulation requires.
 * These are build and added to the app on load with `generateInputs()`, and can be changed live if need be.
 *
 * When a value is changed, it is saved to `globalThis.settings`. Here is an example of what it looks like:
 *
 *	globalThis.settings: {
 * 		network: {
 * 			algorithms: "Bitcoin",
 * 			nodes: 25,
 * 			...
 * 		},
 * 		seed: 3554,
 * 		...
 *	}
 *
 */
globalThis.settings = {};
const allInputs = {
	network: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			algorithms: {
				type: "select",
				label: "Verification",
				options: [
					"Bitcoin",
					"PrebenCoin",
				],
				default: "Bitcoin",
				description: "Which blockchain protocol should be used in the simulation.",
			},
			nodes: {
				type: "range",
				min: 5,
				max: 100,
				default: 20,
				description: "How many nodes should the simulation consist of.",
			},
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow should the network be. In other words; how many milliseconds should it take for a packet to move across the entire network visualization vertically.",
			},
		},
	},
	seed: {
		type: "number",
		min: 1,
		max: 10000,
		step: 1,
		setTo: Math.floor(Math.random() * 10000),
		description: `If you run the simulation multiple times with the same seed, then all runs will be identical. If you use different seeds, then the position of the nodes, as well as which nodes get to publish which blocks, and so on, are all different between runs.`,
	},
	attackers: {
		type: "range",
		min: 0,
		max: 100,
		unit: "%",
		default: 50,
		description: "The percentage of nodes trying to misuse the network. Read more about it in the text section.",
	},
	time: {
		type: "range",
		min: 0.5,
		max: 2,
		step: 0.1,
		unit: "x",
		default: 1,
		description: "Use this to speed up or slow down the simulation to make it easier to follow along. This does not actually change anything in the simulation, it only changes the playback rate.",
	},
	nodes: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow new nodes are added to the network. In other words; how many milliseconds should it take for a new node to be added to the entire network visualization.",
			},
			startNodes: {
				type: "range",
				min: 1,
				max: 100,
				default: 5,
				description: "How many nodes are added to the network in the start of the simulation. In other words; how many nodes the simulation start with having visualizatied.",
			},
			nodesToAdd: {
				type: "range",
				min: 1,
				max: 10,
				default: 5,
				description: "How many nodes are added to the network everytime the network adds new nodes. In other words; how many nodes the simulation adds",
			},
		},
	},
	block: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow new the block should send packets to the network. In other words; how many milliseconds should it take for a new packet to be send to the other blocks in the network visualization.",
			},
		},
	},
};


/**
 * Generates all input elements for the simulation, based on the variable `allInputs` defined above.
 *
 * @param {object} inputData - Description of the input elements to generate.
 * @param savedState
 * @param {object} parent - The element to put the input elements inside of.
 */
function generateInputs(inputData, savedState, parent){
	settingsReset(true);
	for (const [name, data] of Object.entries(inputData)) {

		// Create a label for the control
		const label = document.createElement("label");
		label.innerHTML = `${data.label || name[0].toUpperCase() + name.slice(1)}:`;
		label.for = name;
		parent.appendChild(label);

		// Then create the control along with any other necessary DOM elements for that control
		switch (data.type) {
			case "box": {
				const box = document.createElement("div");
				box.id = name;
				box.classList.add("controlBox");

				parent.appendChild(box);
				generateInputs(data.children, savedState?.[name], box);
				break;
			}

			case "select": {
				const select = document.createElement("select");
				select.name = name;
				select.id = name;

				for (const optionName of data.options) {
					const option = document.createElement("option");
					option.value = optionName;
					option.innerHTML = optionName;
					select.appendChild(option);
				}

				parent.appendChild(select);
				appendDataReader(select);
				select.value = savedState?.[name] ?? data.setTo ?? data.default;

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				select.dispatchEvent(new InputEvent("input"));

				break;
			}

			case "range": {
				const range = document.createElement("input");
				range.type = data.type;
				range.name = name;
				range.id = name;
				range.dataset.unit = data.unit || "";

				for (const key of ["min", "max", "step"]) {
					if (data[key]) range[key] = data[key];
				}

				parent.appendChild(range);
				appendDataReader(range);
				range.value = savedState?.[name] ?? data.setTo ?? data.default;

				const output = document.createElement("output");

				parent.appendChild(output);

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				range.dispatchEvent(new InputEvent("input"));

				break;
			}

			case "number": {
				const number = document.createElement("input");
				number.type = data.type;
				number.name = name;
				number.id = name;

				for (const key of ["min", "max", "step"]) {
					if (data[key]) number[key] = data[key];
				}

				parent.appendChild(number);
				appendDataReader(number);
				number.value = savedState?.[name] ?? data.setTo ?? data.default;

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				number.dispatchEvent(new InputEvent("input"));

				break;
			}

		}
	}
	settingsReset(true);

	/**
	 * This functon should be called on every control element being added to the UI.
	 *
	 * When the user updates a setting with one of the controls,
	 * this function makes sure the change is ported to the `globalThis.settings` object.
	 *
	 * If the control value is shown in an `<output>` field in the DOM, then that is also updated by this function.
	 *
	 * @param {object} element - Control element to listen to.
	 */
	function appendDataReader(element){
		element.addEventListener("input", async event => {
			const element = event.target;

			/**
			 * All of this is just to figure out if the control is inside one or more boxes.
			 *
			 * This is important because if, for example, the control "speed" was inside a box called "connection",
			 * which was in turn inside a box called "network", then the value should be saved as:
			 *
			 * `globalThis.settings.network.connection.speed`.
			 *
			 * And not just as:
			 *
			 * `globalThis.settings.speed`.
			 *
			 * ..which could make it collide with other controls that also have that name, but are used for something other than network connections.
			 *
			 */

			const scopes = [];
			let domScope = element;

			// Move up the tree of the control's DOM parents and save the name of each control box.
			// Stop when encountering a parent that is not a control box.
			while (domScope.parentElement.classList.contains("controlBox")) {
				domScope = domScope.parentElement;

				scopes.push(domScope.id);
			}

			// We have saved the box names going from the inside-out, but we want to create the settings element from the outside-in, so we reverse the order.
			scopes.reverse();

			// Now we iterate through each box name, and make sure an object is saved inside the `globalThis.settings` object with that name.
			let settingsScope = globalThis.settings;
			for (const scope of scopes) {
				settingsScope[scope] ??= {};
				settingsScope = settingsScope[scope];
			}

			/**
			 * At this point, we are left with the desired settings object structure. In the case of the above example, the object looks like:
			 *
			 * 	globalThis.settings: {
			 * 		network: {
			 * 			connection: {
			 * 				...
			 *			}.
						...
			 * 		}.
			 * 		...
			 * 	}.
			 *
			 * All the "..." just represent that there could maybe already be information in these objects that we don't know about / don't care about.
			 *
			 * The `settingsScope` now points to `globalThis.settings.network.connection`, so now we are ready to actually add the control value to the object.
			 */


			/**
			 * Here comes the important part of the function.
			 */

			// Update to the new value in `globalThis.settings`.
			if(["range", "number"].includes(element.type)){
				settingsScope[element.name] = Number(element.value);
			}else{
				settingsScope[element.name] = element.value;
			}

			// If an `<output>` field is associated with this control in the UI, update that field as well.
			if (element.nextElementSibling?.tagName === "OUTPUT") {
				element.nextElementSibling.value = element.value + element.dataset.unit;
			}

			globalThis.lastSettingsChange = Date.now();
			settingsReset();

		});
	}

	/**
	 * @param force
	 */
	function settingsReset(force = false){
		const resetDelay = 1000;
		if(!force && Date.now() - globalThis.lastSettingsChange < resetDelay){
			if(globalThis.nextSettingsReset - globalThis.lastSettingsChange < resetDelay){
				globalThis.nextSettingsReset = globalThis.lastSettingsChange + resetDelay;
				setTimeout(settingsReset, globalThis.nextSettingsReset - Date.now());
			}
			return;
		}

		//Save the new settings in the URL bar
		globalThis.urlState.update();

		// When settings have changed, we should reset the simulation and prepare for a new run.
		resetSimulation();
	}
}
globalThis.lastSettingsChange = 0;
globalThis.nextSettingsReset = 0;

class Messages{
	#rollingId = 0n;
	#newId(){
		this.#rollingId += 1n;
		return String(this.#rollingId);
	}
	#messages = new Map();
	get m(){return this.#messages;}
	new({type = "info", text, time = 15000}){
		const id = this.#newId();
		const newMessage = new this.#Message(id, {type, text});
		for(const otherMessage of this.#messages.values()){
			otherMessage.top += newMessage.height;
		}
		document.body.append(newMessage.domInstance);
		setTimeout(newMessage => newMessage.domInstance.style.opacity = 1, 10, newMessage);
		this.#messages.set(id, newMessage);
		setTimeout(id => globalThis.messages.remove(id), time, id);
	}
	remove(id){
		const oldMessage = this.#messages.get(id);
		if(!oldMessage) return;
		this.#messages.delete(id);
		for(const otherMessage of this.#messages.values()){
			if(otherMessage.top > oldMessage.top) otherMessage.top -= oldMessage.height;
		}
		oldMessage.domInstance.style.opacity = 0;
		setTimeout(oldMessage => oldMessage.domInstance.remove(), oldMessage.transitionTime * 2, oldMessage);
	}
	#Message = class{
		constructor(id, {top = 0, type, text}){
			this.domInstance = document.createElement("div");
			this.id = id;
			this.top = top;
			this.height = 4;

			this.domInstance.classList.add("message");
			this.domInstance.classList.add(type);
			this.domInstance.style.transitionDuration = `${this.transitionTime}ms`;

			const p = document.createElement("p");
			p.innerHTML = text;
			const button = document.createElement("button");
			button.innerHTML = "×";
			button.ariaLabel = "Close this message";
			button.addEventListener("click", event => {
				globalThis.messages.remove(event.target.parentElement.dataset.id);
			});
			this.domInstance.append(p);
			this.domInstance.append(button);

		}

		#id;
		get id(){
			return this.#id;
		}
		set id(value){
			this.#id = value;
			this.domInstance.dataset.id = value;
		}
		domInstance;
		transitionTime = 200;
		verticalUnit = "vh";
		#height;
		get height(){
			return this.#height;
		}
		set height(value){
			this.#height = value;
			this.domInstance.style.setProperty("--height", `${this.height}${this.verticalUnit}`);
		}
		#top;
		get top(){
			return this.#top;
		}
		set top(value){
			this.#top = value;
			this.domInstance.style.top = `${value}${this.verticalUnit}`;
		}
	};
}

class URLState{
	constructor(settings){
		this.#versionHash = this.#generateVersionHash(settings);
		this.#restoreSettings(allInputs, {});

		this.#finished = new Promise(resolve => {
			/**
			 *
			 */
			function check(){
				if(
					globalThis.urlState?.restoredTime !== undefined &&
					globalThis.urlState?.restoredSettings !== undefined) {
					resolve();
				}else{
					setTimeout(check, 300);
				}
			}
			check();
		});

	}
	#finished;
	get finished(){
		return this.#finished;
	}
	#restoredSettings;
	get restoredSettings(){
		return this.#restoredSettings;
	}
	#restoredTime;
	get restoredTime(){
		return this.#restoredTime;
	}

	#stateLayoutVersion = 1;

	#versionHashLength = 4;
	#versionHash;

	#settingsSeparators = {
		skip: "-",
		number: ".",
		string: "~",
	};
	#settingStringHashLength = 3;

	async #generateVersionHash(settings, recursiveCall = false){

		let seed = "";

		for(const key of Object.keys(settings).sort()){
			seed += key;

			const object = settings[key];
			if(object.type === "box"){
				seed += await this.#generateVersionHash(object.children, true);
			}
		}

		if(recursiveCall) {return seed;} else{
			return await hash(`${this.#stateLayoutVersion}${seed}`, this.#versionHashLength);
		}

	}
	#skipsToDo = 0;
	async #restoreSettings(settingsMeta, { recursiveCall = false, buffer, cursor = 0 }){
		const restoredSettings = {};

		if(!recursiveCall && !buffer){
			const parameters = new URLSearchParams(window.location.search);
			const state = decodeURIComponent(parameters.get("s") || "");
			if(!state){
				this.#restoredTime = 0;
				this.#restoredSettings = {};
				return;
			}
			const hash = state.slice(0, this.#versionHashLength);
			if(hash !== await this.#versionHash){
				globalThis.messages.new({
					text: "Unable to restore the state saved in the URL. The state was saved by an older version of this app, which used a different settings layout.",
				});
				this.#restoredTime = 0;
				this.#restoredSettings = {};
				return;
			}
			buffer = state.slice(this.#versionHashLength).split("");
		}


		if(!recursiveCall && cursor === 0){
			let encodedTime = "";
			cursor++;
			while(!Object.values(this.#settingsSeparators).includes(buffer[cursor]) && cursor < buffer.length){
				encodedTime += buffer[cursor];
				cursor++;
			}
			this.#restoredTime = parseInt(encodedTime, 36) * 100;
		}

		let settingsIndex = 0;
		throughBuffer: while(cursor < buffer.length && settingsIndex < Object.keys(settingsMeta).length){
			const settingKey = Object.keys(settingsMeta).sort()[settingsIndex];

			if(settingsMeta[settingKey].type === "box"){
				const { restoredSettings: _restoredSettings, cursor: _cursor } = await this.#restoreSettings(
					settingsMeta[settingKey].children,
					{
						recursiveCall: true,
						buffer,
						cursor,
					},
				);
				restoredSettings[settingKey] = _restoredSettings;
				cursor = _cursor;
			}else if(this.#skipsToDo === 0){
				let type;
				for(const [ name, separator ] of Object.entries(this.#settingsSeparators)){
					if(separator === buffer[cursor]){
						type = name;
						break;
					}
				}

				let encodedValue = "";
				cursor++;
				while(!Object.values(this.#settingsSeparators).includes(buffer[cursor]) && cursor < buffer.length){
					encodedValue += buffer[cursor];
					cursor++;
				}

				let value;
				switch(type){
					case "skip": {
						this.#skipsToDo = parseInt(encodedValue, 36);
						continue throughBuffer;
					}
					case "number": {
						value = parseInt(encodedValue, 36);
						break;
					}
					case "string": {
						for(const option of settingsMeta[settingKey].options){
							if(encodedValue === await hash(option, this.#settingStringHashLength)){
								value = option;
							}
						}
						break;
					}
				}

				restoredSettings[settingKey] = value;
			}else{
				this.#skipsToDo--;
			}
			settingsIndex++;
		}

		if(recursiveCall){
			return { restoredSettings, cursor };
		}else{
			this.#restoredSettings = restoredSettings;
		}

	}

	#lastUpdate = 0;
	get lastUpdate(){
		return this.#lastUpdate;
	}
	#timelineUpdateFrequency = 2000;
	get timelineUpdateFrequency(){
		return this.#timelineUpdateFrequency;
	}
	async update(){
		this.#lastUpdate = Date.now();
		const state = encodeURIComponent(await this.#generateState(allInputs, globalThis.settings));
		const hash = encodeURIComponent(await this.#versionHash);
		const now = encodeURIComponent(Math.round(globalThis.simulationTime.now / 100).toString(36));
		history.replaceState(
			null,
			"",
			`?s=${hash}${this.#settingsSeparators.number}${now}${state}`,
		);
	}

	async #generateState(settingsMeta, settingsValues, recursiveCall = false){
		const state = [];

		for(const key of Object.keys(settingsMeta).sort()){
			const settingMeta = settingsMeta[key];
			const settingValue = settingsValues[key];

			if(settingMeta.type === "box"){
				if(typeof settingValue === "object"){
					state.push(...await this.#generateState(settingMeta.children, settingValue, true));
				}
			}else if(settingValue === undefined || settingValue === settingMeta.default){
				state.push(null);
			}else{
				state.push(settingValue);
			}
		}

		if(recursiveCall){
			return state;
		}else{
			let minifiedState = "";

			let skips = 0;
			for(let s of state){
				if(s === null){
					skips += 1;
				}else{
					if(skips > 0){
						minifiedState += `${this.#settingsSeparators.skip}${skips.toString(36)}`;
						skips = 0;
					}
					const type = typeof s;
					switch(type){
						case "number": {
							s = Math.round(s).toString(36);
							break;
						}
						case "string": {
							s = await hash(s, this.#settingStringHashLength);
							break;
						}
						default: {
							throw new TypeError(`Unknown settings type "${type}" when generating URL state`);
						}
					}
					minifiedState += `${this.#settingsSeparators[type]}${s}`;
				}
			}

			return minifiedState;
		}


	}
}

class Timeline{
	constructor(){
		this.#DOMElement = document.getElementById("timeline");

		this.#DOMElement.addEventListener("input", async event => {
			this.#lastUserInput = Date.now();
			this.#frozen = true;
			globalThis.simulationTime.now = Number(event.target.value);
			this.#updateDOMOutput();
			this.poke();
		});
		this.#DOMElement.addEventListener("mousedown", () => {
			this.#userControlled = true;
		});
		this.#DOMElement.addEventListener("mouseup", () => {
			this.#userControlled = false;
		});
		this.#DOMElement.addEventListener("focusout", () => {
			this.#userControlled = false;
		});

		this.poke();

	}

	#updateDelay = 400;
	#lastTimelineUpdate = 0;
	#last = {
		max: 0,
		value: 0,
	};
	#DOMElement;


	#userInputFreeze = 1700;

	#lastUserInput = 0;

	#internal_frozen = false;
	#internal_simulationTimeWasPausedBeforeFreeze = false;
	get #frozen(){
		return this.#internal_frozen;
	}
	set #frozen(value){
		if(value === this.#internal_frozen) return;
		this.#internal_frozen = value;
		if(value){
			this.#internal_simulationTimeWasPausedBeforeFreeze = globalThis.simulationTime.paused;
			globalThis.simulationTime.pause();
		}else{
			if(!this.#internal_simulationTimeWasPausedBeforeFreeze) globalThis.simulationTime.resume();
		}
	}

	#internal_userControlled = false;
	get #userControlled(){
		return this.#internal_userControlled;
	}
	set #userControlled(value){
		if(value === this.#internal_userControlled) return;
		this.#internal_userControlled = value;
		if(value){
			this.#frozen = true;
		}else{
			this.poke();
		}
	}

	get #max(){
		return Math.max(
			5000,
			globalThis.events?.at(-1)?.timestamp ?? 0,
			globalThis.simulationTime?.now === undefined ? 0 : globalThis.simulationTime.now * 1.5,
		);
	}

	#updateDOMOutput(){

		this.#DOMElement.nextElementSibling.value = `${readable(globalThis.simulationTime.now)} / ${readable(this.#DOMElement.max)}`;

		/**
		 * @param time
		 */
		function readable(time){

			const orders = [
				[1000, "second"],
				[60, "minute"],
				[60, "hour"],
			];
			let i = 0, order, unit;

			do{
				[ order, unit ] = orders[i];
				time /= order;
				i++;
			}while(time > 100 && i <= orders.length);

			return new Intl.NumberFormat(
				"en-US",
				{
					style: "unit",
					unit,
					maximumFractionDigits: 0,
				},
			).format(time);
		}
	}

	#running = false;
	#lastPoke = 0;
	async poke(forceUpdate = false){
		const ranAt = Date.now();
		this.#lastPoke = ranAt;
		if(this.#running) return;
		this.#running = true;

		if(this.#frozen && !this.#userControlled){
			if(Date.now() - this.#lastUserInput > this.#userInputFreeze){
				this.#frozen = false;
			}else{
				setTimeout(() => {globalThis.timeline.poke();}, this.#userInputFreeze - (Date.now() - this.#lastUserInput) + 1);
			}
		}

		const max = this.#max;
		const now = globalThis.simulationTime.now;

		if(
			forceUpdate ||
			(!this.#frozen && Date.now() - this.#lastTimelineUpdate > this.#updateDelay)
		){
			this.#lastTimelineUpdate = Date.now();

			this.#DOMElement.max = max;
			this.#DOMElement.value = now;
			this.#updateDOMOutput();
		}

		const changed = Boolean(this.#last.max !== max || this.#last.now !== now || this.#last.ranAt - ranAt > this.#updateDelay * 2);

		if(forceUpdate || changed || this.#lastPoke !== ranAt){
			setTimeout(() => {globalThis.timeline.poke();}, this.#updateDelay + 1);
		}

		this.#last = {
			max,
			now,
			ranAt,
		};
		this.#running = false;
	}


}

/**
 * When called, resets the entire simulation as if the app had just been opened.
 * This is mostly useful when the user has changed some settings and the simulation should run again from the start.
 *
 * @param full
 */
export function resetSimulation(full = true){
	if(full){
		globalThis.simulation?.terminate();
		globalThis.events = [];
	}
	globalThis.eventDispatcher.reset();

	// Remove all the DOM elements that represent the nodes, connections, and so on.
	document.querySelector("#visualizer .network").innerHTML = "";
	document.querySelector("#visualizer .blockchain").innerHTML = "";

	if(full){
		// Open a new underlying simulation
		globalThis.simulation = new Simulation();
	}
}

/**
 * @param string
 * @param length
 */
async function hash(string, length){
	const encoder = new TextEncoder();

	const buffer = encoder.encode(string).buffer;
	const hash = (await crypto.subtle.digest("sha-1", buffer)).slice(0, length);
	const textHash = Array.from(new Uint8Array(hash)).map(number => number.toString(36).at(-1)).join("");

	return textHash;
}

/**
 * This eventlistener handles when the user clicks on the play button.
 * It can both pause and resume the simulation.
 */
const playButton = document.getElementById("play");
playButton.addEventListener("click", event => {
	const button = event.target;

	if(button.classList.contains("paused")){
		// Button was paused, resume playback
		globalThis.simulationTime.resume();
		globalThis.timeline.poke(true);
		button.innerHTML = "Pause";
		button.classList.remove("paused");
	}else{
		// Button was playing, pause playback
		globalThis.simulationTime.pause();
		globalThis.timeline.poke(true);
		button.innerHTML = "Play";
		button.classList.add("paused");
		globalThis.urlState.update();
	}
});

const resetButton = document.getElementById("reset");
resetButton.addEventListener("click", () => {

	if(!playButton.classList.contains("paused")){
		playButton.click();
	}

	globalThis.simulationTime.reset();
	globalThis.timeline.poke(true);
});

/**
 * When the visualization runs, it needs to know the dimensions of the box that the visualization runs in.
 * Whenever the browser window changes size in any way, this function runs and saves the new network box ratio to `globalThis.settings`.
 *
 * In this visualization, it is assumed that the height of the network box is always 1,
 * so all that the simulation needs to know is the ratio between the height of the box and the width.
 *
 */
async function updateNetworkBoxSize(){
	const visualization = document.querySelector("#visualizer .network");
	globalThis.settings.networkBoxRatio = visualization.clientWidth / visualization.clientHeight;
}
window.addEventListener("resize", updateNetworkBoxSize);
updateNetworkBoxSize();

/**
 * Set up the necessary classes to run the simulation. You can read more about each class in their respective files.
 */
globalThis.messages = new Messages();
globalThis.urlState = new URLState(allInputs);
await globalThis.urlState.finished;
globalThis.eventDispatcher = new EventDispatcher();
globalThis.simulationTime = new SimulationTime();
globalThis.eventDrawer = new EventDrawer();
globalThis.timeline = new Timeline();

/**
 * Running `generateInputs` here is what gets the whole app going. It doesn't just generate the controls,
 * but as a side product also generates the initial `globalThis.settings`, which in turn starts the simulation.
 */
generateInputs(allInputs, globalThis.urlState.restoredSettings, document.getElementById("controls"));




const showAndHideButton = document.getElementById("showHide");
const sidebar = document.getElementById("sidebar");
sidebar.style.display = "none";

showAndHideButton.addEventListener("click", () => {
	const element = document.getElementById("sidebar");

	if (element.style.display !== "inline"){
		element.style.display = "inline";
	} else {
		element.style.display = "none";
	}

});
