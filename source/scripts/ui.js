/**
 * @file
 * This file is the main handler for all UI elements in the app, most of the direct changes
 * to DOM elements should happen in this file.
 * All of the underlying simulation functionality of the app is imported into this file
 * from other files.
 */

import { Simulation, SimulationTime, EventDispatcher, EventDrawer } from "./simulationHandlers.js";
import { hash } from "./utilities.js";
import controls from "./controls.js";

/**.
 * This contains all the settings that the user can change in the UI. Here is an example
 * of what that can look like:
 *
 *	globalThis.settings: {
 *  	aspectRatio: 2,
 * 		seed: 1337,
 * 		network: {
 * 			algorithms: "Balanced",
 * 			nodes: 15,
 * 			...
 * 		},
 * 		...
 *	}
 *
 * All possible settings are defined in the `controls.js` file.
 */
globalThis.settings = {};

/**
 * Generates all input elements for the simulation, based on the `controls` defined in the `controls.js` file.
 *
 * @param {object} inputData - Description of the input elements to generate.
 * @param {object} savedState - An object representing any settings that have been restored from the URL.
 * @param {object} parent - The HTML element to put the input elements inside of.
 */
function generateInputs(inputData, savedState, parent){
	settingsReset(true);

	// For each control/setting:
	for (const [name, data] of Object.entries(inputData)) {

		// Create a label for the control
		const label = document.createElement("label");
		label.innerText = `${data.label || name[0].toUpperCase() + name.slice(1)}`;
		label.for = name;
		parent.appendChild(label);

		// If a description is defined, make it available for the user.
		if(data.description !== undefined){

			// Generate a tooltip icon
			const tooltip = document.createElement("button");
			tooltip.title = data.description;
			tooltip.ariaLabel = data.description;
			tooltip.classList.add("tooltip");
			tooltip.for = name;
			label.appendChild(tooltip);

			// Along with a dialog with the description
			const dialog = document.createElement("dialog");
			dialog.classList.add("tooltip-dialog");
			dialog.innerText = data.description;
			label.appendChild(dialog);

			// Make sure you can open the dialog by clicking the tooltip
			tooltip.addEventListener("click", event => {
				const dialog = event.target.nextElementSibling;
				if (dialog.nodeName !== "DIALOG") return;

				dialog.showModal();
			});

			// Make sure you can close the dialog by pressing anywhere
			dialog.addEventListener("click", event => {
				event.preventDefault();
				const dialog = event.target;
				if (dialog.nodeName === "DIALOG"){
					dialog.close("dismiss");
				}
			});

		}

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
					option.innerText = optionName;
					select.appendChild(option);
				}

				parent.appendChild(select);
				appendDataReader(select);
				select.value = savedState?.[name] ?? data.setTo?.() ?? data.default;

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
				range.value = savedState?.[name] ?? data.setTo?.() ?? data.default;

				const output = document.createElement("output");

				parent.appendChild(output);

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				range.dispatchEvent(new InputEvent("input"));

				break;
			}

			case "checkbox": {
				const checkbox = document.createElement("input");
				checkbox.type = data.type;
				checkbox.name = name;
				checkbox.id = name;

				parent.appendChild(checkbox);
				appendDataReader(checkbox);
				checkbox.checked = savedState?.[name] ?? data.setTo?.() ?? data.default;

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				checkbox.dispatchEvent(new InputEvent("input"));

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
				number.value = savedState?.[name] ?? data.setTo?.() ?? data.default;

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				number.dispatchEvent(new InputEvent("input"));

				break;
			}

		}

		// Add a "reset" button to certain elements to make it easier for the user to restore to default settings.
		if(["select", "range", "number"].includes(data.type)){
			const updateButton = document.createElement("button");
			updateButton.title = "Reset this value";
			updateButton.ariaLabel = "Reset this value";
			updateButton.classList.add("update");
			updateButton.dataset.for = name;
			parent.appendChild(updateButton);

			// Register an event listener that can find the default valie in `controls.js`
			// and restore the control to that value.
			updateButton.addEventListener("click", async event => {
				const button = event.target;
				let { controlsMetaScope } = findScopeFromDom(button);
				if(controlsMetaScope.type === "box") controlsMetaScope = controlsMetaScope.children;
				const controlsEntry = controlsMetaScope[button.dataset.for];

				let input = button;
				while(input.id !== button.dataset.for){
					input = input.previousElementSibling;
				}

				input.value = controlsEntry.setTo?.() ?? controlsEntry.default;
				input.dispatchEvent(new InputEvent("input"));

			});

		}
	}
	settingsReset(true);

	/**
	 * This functon should be called on every control element being added to the UI.
	 *
	 * When the user updates a setting with one of the controls, this function makes
	 * sure the change is also updated to the `globalThis.settings` object.
	 *
	 * If the control value is shown in an `<output>` field in the DOM, then that is
	 * also updated by this function.
	 *
	 * @param {object} element - HTML control element to listen to.
	 */
	function appendDataReader(element){
		element.addEventListener("input", async event => {
			const element = event.target;

			const { settingsScope } = findScopeFromDom(element);

			// Update to the new value in `globalThis.settings`.
			if(element.type === "checkbox"){
				settingsScope[element.name] = element.checked;
			}else if(["range", "number"].includes(element.type)){
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
	 * Finds the scope for an HTML control element.
	 *
	 * @param {object} element - The control element to find the scope for.
	 *
	 * @returns {object} - Object scopes for the `settings` object and the `controls.js` definition.
	 */
	function findScopeFromDom(element){

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
		let controlsMetaScope = controls;
		for (const scope of scopes) {

			settingsScope[scope] ??= {};
			settingsScope = settingsScope[scope];

			controlsMetaScope = controlsMetaScope.type === "box" ? controlsMetaScope.children[scope] : controlsMetaScope[scope];

		}

		/**
		 * At this point, we are left with the desired settings object structure. In the case of the above example, the object looks like:
		 *
		 * 	globalThis.settings: {
		 * 		network: {
		 * 			connection: {
		 * 				...
		 *			}.
		 *  		...
		 * 		}.
		 * 		...
		 * 	}.
		 *
		 * All the "..." just represent that there could maybe already be information in these objects that we don't know about / don't care about.
		 *
		 * The `settingsScope` now points to `globalThis.settings.network.connection`, so now we are ready to actually add the control value to the object.
		 */

		return { settingsScope, controlsMetaScope };

	}

	/**
	 * This is called when the user has changed some of the controls, and the simulation should
	 * prepare to be reset. In most cases, the function will wait a small amount of time before
	 * resetting the simulation.
	 * This is useful because otherwise, the simulation would reset every single time a small
	 * change has been made (could be several times a second), and spend lots of CPU cycles
	 * (some of them blocking) to simulate the new settings, just to be immediately terminated.
	 *
	 * @param {boolean} force - If set to true, will immediately reset the simulation without waiting first.
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

/**
 * Represents all error/info messages that are shown at the top of the screen to the user.
 */
class Messages{

	// A map of all currently active messages.
	#messages = new Map();

	/**
	 * Creates a new ID for a new message.
	 *
	 * @returns {bigint} - The ID.
	 */
	#newId(){
		this.#rollingId += 1n;
		return String(this.#rollingId);
	}
	#rollingId = 0n;

	/**
	 * Generates a new message.
	 *
	 * @param {object} param0 - An object containing the settings for this message.
	 * @param {string} param0.type - The type of message (info|warning|error).
	 * @param {string} param0.text - The text to write in the message.
	 * @param {string} param0.time - The amount of time to wait before auto-dismissing the message.
	 */
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

	/**
	 * Removes an message that is currently shown on the page.
	 *
	 * @param {bigint} id - The ID of the message to remove.
	 */
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

	/**
	 * Represents a single HTML message.
	 */
	#Message = class{

		/**
		 * Generates a single new message and adds it to the HTML DOM.
		 *
		 * @param {bigint} id - The ID that this message is assigned.
		 * @param {object} param1 - The settings object for the message.
		 * @param {number} param1.top - How far from the top the message should be shown (to make room for other messages).
		 * @param {object} param1.type - The type of message (info|warning|error).
		 * @param {object} param1.text - The text to write in the message.
		 *
		 */
		constructor(id, {top = 0, type, text}){
			this.domInstance = document.createElement("div");
			this.id = id;
			this.top = top;
			this.height = 4;

			this.domInstance.classList.add("message");
			this.domInstance.classList.add(type);
			this.domInstance.style.transitionDuration = `${this.transitionTime}ms`;

			const p = document.createElement("p");
			p.innerText = text;
			const button = document.createElement("button");
			button.innerText = "×";
			button.ariaLabel = "Close this message";
			button.addEventListener("click", event => {
				globalThis.messages.remove(event.target.parentElement.dataset.id);
			});
			this.domInstance.append(p);
			this.domInstance.append(button);

		}

		// How long should it take for the open/close transitions.
		transitionTime = 200;

		// Which unit is used to size the messages.
		verticalUnit = "vh";

		// The HTML DOM object for this specific message.
		domInstance;

		#id;
		get id(){
			return this.#id;
		}
		set id(value){
			this.#id = value;
			this.domInstance.dataset.id = value;
		}

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

/**
 * Represents the settings that have been saved in the URL.
 *
 * When the user changes any settings, they are saved to the URL. This allows the
 * user to copy the URL and send it to a friend that can then fully repeat the same
 * simulation. It also means that a refresh of the app doesn't reset the settings.
 *
 * To prevent the URL from becomming extremely long, the values are encoded with as
 * few characters as possible. Their values are also not based on their names,
 * but their position in the list of controls.
 * Numeric values are encoded as base 36, and strings just use a short hash.
 * We have essentially made a small compression format for the controls.
 *
 * Right now, the settings can only be read between apps that have the exact same
 * settings layout. If some new settings are added, then all old URLs become invalid.
 * This should probably be fixed in a future version, but it will result in a longer URL.
 */
class URLState{

	/**
	 * Sets up the URLState handler and generates a settings object that restores the
	 * settings that are currently saved in the URL.
	 *
	 * @param {object} settings - The settings defined in `controls.js`.
	 */
	constructor(settings){
		this.#versionHash = this.#generateVersionHash(settings);
		this.#restoreSettings(controls, {});

		this.#finished = new Promise(resolve => {
			/**
			 * This is a bit of a hack. It just checks whether the url state is
			 * finished every 300ms. When it is, it resolves the promise.
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

	/**
	 * Generates a version hash for this specific set of settings/controls
	 * and this specific way to decode/encode the URL.
	 * This is used to test whether the existing encoded URL used the same
	 * setup of settings and encoder. If the version hash in the existing
	 * URL is different, then we know that it won't be possible to decode
	 * it. Otherwise, we know that decoding should work perfectly.
	 *
	 * @param {object} settings - The controls setup from `controls.js`.
	 * @param {boolean} recursiveCall - Whether or not it is called by itself as part of a recursive call.
	 * @returns {string} - The computed version hash.
	 */
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

	// A promise that resolves when the handler is set up and has restored the settings in the URL.
	#finished;
	get finished(){
		return this.#finished;
	}

	// A settings object representing the settings that was stored in the URL.
	#restoredSettings;
	get restoredSettings(){
		return this.#restoredSettings;
	}

	// The timestamp to set the simulation to (from the encoded URL)
	#restoredTime;
	get restoredTime(){
		return this.#restoredTime;
	}

	// If something about how the settings are encoded in the URL gets changed,
	// then update this number to invalidate older versions of the URL that uses
	// the now unsupported encoding.
	#stateLayoutVersion = 1;

	// How amny characters the version hash should use.
	#versionHashLength = 4;

	// The computed version hash for this exact set of settings/controls and this exact URL decoder/encoder.
	#versionHash;

	// Which operators to use for the different types of values that can be encoded.
	#settingsSeparators = {
		skip: "-",
		number: ".",
		string: "~",
		boolean: "!",
	};

	// How many characters the hash for a string value should use.
	#settingStringHashLength = 3;

	// Tiemstamp of the last time the URL was updated.
	#lastUpdate = 0;
	get lastUpdate(){
		return this.#lastUpdate;
	}

	// How often the URL should be updated to reflect a new timeline timestamp.
	#timelineUpdateFrequency = 2000;
	get timelineUpdateFrequency(){
		return this.#timelineUpdateFrequency;
	}

	/**
	 * Updates the URL to reflect any settings that might have been changed in the project.
	 */
	async update(){
		this.#lastUpdate = Date.now();
		const state = encodeURIComponent(await this.#generateState(controls, globalThis.settings));
		const hash = encodeURIComponent(await this.#versionHash);
		const now = encodeURIComponent(Math.round(globalThis.simulationTime.now / 100).toString(36));
		history.replaceState(
			null,
			"",
			`?s=${hash}${this.#settingsSeparators.number}${now}${state}`,
		);
	}

	/**
	 * Generates a `settings` object based on the settings that were already encoded in the URL
	 * when the app was started.
	 *
	 * @param {object} settingsMeta - The settings object from `controls.js`.
	 * @param {object} param1 - Settings that the function uses when it needs to call itself recursively.
	 * @param {boolen} param1.recursiveCall - True if this is a recursive call.
	 * @param {string} param1.buffer - The part of the URL to decode.
	 * @param {number} param1.cursor - Which character in the URL that is currently being decoded.
	 *
	 * @returns {void|object} - Only used for recursive results. Otherwise the result is saved in `restoredSettings`.
	 */
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
					case "boolean": {
						value = Boolean(encodedValue === "t");
						break;
					}
					default: {
						throw new TypeError(`Unknown settings type "${type}" when restoring URL state`);
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
	#skipsToDo = 0;

	/**
	 * Encodes a new URL based on the current settings.
	 *
	 * @param {object} settingsMeta - The settings setup from `controls.js`.
	 * @param {object} settingsValues - The current values of all settings.
	 * @param {boolean} recursiveCall - True if this is a recursive call.
	 *
	 * @returns {string|any[]} - The final string to indert in the URL (in a recursive call, an array of the values found).
	 */
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
						case "boolean": {
							s = s ? "t" : "";
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

/**
 * Represents the timeline that shows the user how for into the simulation they are.
 * It also gives them access to skip around in the simulation.
 *
 * It is tightly integrated with the play/pause/reset buttons.
 */
class Timeline{

	/**
	 * Connects to the timeline HTML element and registers the necessary event listeners.
	 */
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

	// How often the timeline should be updated to reflect the real amount of time elapsed.
	// It would be excessive to update this every millisecond, and would make the UI
	// unresponsive, therefore it only happens once in a while.
	// Defined in milliseconds.
	#updateDelay = 400;

	// Timestamp for the last time the timeline was updated to reflect the real amount of time elapsed.
	#lastTimelineUpdate = 0;

	// The value of the elsaped time and max time, as it was the last time the timeline was updated.
	#last = {
		max: 0,
		value: 0,
	};

	// Reference to the HTML DOM element for the timeline.
	#DOMElement;


	#userInputFreeze = 1700;

	// Timestamp for the last time the user skipped around in the timeline.
	#lastUserInput = 0;

	/**
	 * When the user starts dragging the timeline, it should stop updating itself with the current
	 * timestamp, and instead let the user drag the slider wherever they want.
	 * Whe have two booleans to describe that state called `userControlled` and `frozen`.
	 * `userControlled` becomes false as soon as the user stops dragging the timeline.
	 * `frozen` does not become false until it has waited a small amount of time to make sure that
	 * the user is completely done dragging the timeline.
	 * Only when `frozen` becomes false, does the timeline start updating again.
	 */
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

	/**
	 * Calculates the max amount of time shown in the timeline.
	 * It should always be a little more than the current elapsed time,
	 * to allow the user to skip forward in the simulation.
	 *
	 * @returns {number} - The max amount of time in milliseconds.
	 */
	get #max(){
		return Math.max(
			5000,
			globalThis.events?.at(-1)?.timestamp ?? 0,
			globalThis.simulationTime?.now === undefined ? 0 : globalThis.simulationTime.now * 1.5,
		);
	}

	/**
	 * Updates the timeline output in the DOM with new values for elapsed/max time.
	 */
	#updateDOMOutput(){

		this.#DOMElement.nextElementSibling.value = `${readable(globalThis.simulationTime.now)} / ${readable(this.#DOMElement.max)}`;

		/**
		 * Takes an amount of time and converts it to an easily readable format.
		 *
		 * @param {number} time - The amount of time in milliseconds.
		 *
		 * @returns {string} - A human readable version of that amount of time.
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

	/**
	 * This is what keeps the timeline running and self-updating. If the simulaiton has been paused
	 * and is now starting again, other functions can call this to make sure that the timeline wakes
	 * up and starts updating. As long as the simulation is running, this function will call itself
	 * in short intervals to keep the timeline updated.
	 *
	 * @param {boolean} forceUpdate - If true, will always update the timeline, even though it was just updated a few milliseconds ago.
	 */
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
	#running = false;
	#lastPoke = 0;

}

/**
 * When called, resets the entire simulation as if the app had just been opened.
 * This is mostly useful when the user has changed some settings and the simulation should run again from the start.
 *
 * @param {boolean} full - If false, does a "soft reset" which reloads the UI, but not the underlying simulation.
 */
export function resetSimulation(full = true){
	if(full){
		globalThis.simulation?.terminate();
		globalThis.events = [];
	}
	globalThis.eventDispatcher.reset();

	// Remove all the DOM elements that represent the nodes, connections, and so on.
	document.querySelector("#visualizer .network").innerHTML = "";
	document.querySelector("#visualizer .blockchain > .aspect-reset").innerHTML = "";

	// Set the correct aspect ratio for the simulation network
	document.querySelector("#visualizer .network").style.setProperty("--aspect-ratio", globalThis.settings.aspectRatio);

	if(full){

		// Open a new underlying simulation
		globalThis.simulation = new Simulation();

		// Remove all logs from the simulation
		document.getElementById("nerd-log").innerHTML = "";

	}

	showNerdInfo();
}

/**
 * If the user has decided to acivate "nerd info", then this function will run on an interval
 * to update the info boxes, showing what is going on in the underlying simulation.
 *
 * @param {object} state - Data passed on from the last call to `showNerdInfo`.
 */
async function showNerdInfo(state = {lastEventUpdate: 0, lastEventLength: 0, lastOrderUpdate: 0, lastOrder: true}){
	const nerdInfo = document.getElementById("nerd-info");

	if(globalThis.settings.nerdInfo){
		document.body.classList.add("nerd-info");
	}else{
		document.body.classList.remove("nerd-info");
		return;
	}

	if(globalThis.events.length !== state.lastEventLength){
		state.lastEventUpdate = Date.now();
		state.lastEventLength = globalThis.events.length;
	}
	if(globalThis.simulation.paused !== state.lastOrder){
		state.lastOrderUpdate = Date.now();
		state.lastOrder = globalThis.simulation.paused;
	}

	const [
		threads,
		orderedSimulationStatus,
		actualSimulationStatus,
		timelineBuffer,
		bufferedEvents,
	] = nerdInfo.querySelectorAll("output");

	const concurrency = window.navigator.hardwareConcurrency;
	threads.value = concurrency;
	if(concurrency >= 4){
		threads.dataset.status = "good";
	}else if(concurrency >= 3){
		threads.dataset.status = "acceptable";
	}else{
		threads.dataset.status = "bad";
	}

	if(globalThis.simulation.paused){
		orderedSimulationStatus.value = "Pause";
		orderedSimulationStatus.dataset.status = "good";
	}else{
		orderedSimulationStatus.value = "Run";
		orderedSimulationStatus.dataset.status = "acceptable";
	}

	const timeSinceLastEventUpdate = Date.now() - state.lastEventUpdate;
	const timeSinceLastOrderUpdate = Date.now() - state.lastOrderUpdate;
	if(timeSinceLastEventUpdate > 1500){
		actualSimulationStatus.value = "Not running";
		if(globalThis.simulation.paused){
			actualSimulationStatus.dataset.status = "good";
		}else{
			actualSimulationStatus.dataset.status = timeSinceLastOrderUpdate < 2000 ? "acceptable" : "bad";
		}
	}else{
		actualSimulationStatus.value = "Running";
		if(globalThis.simulation.paused){
			actualSimulationStatus.dataset.status = timeSinceLastOrderUpdate < 2000 ? "acceptable" : "bad";
		}else{
			actualSimulationStatus.dataset.status = "good";
		}
	}

	const simulationNow = globalThis.events.length > 0 ? globalThis.events.at(-1).timestamp : 0;
	const bufferValue = Math.round(simulationNow - globalThis.simulationTime.now);
	timelineBuffer.value = `${new Intl.NumberFormat().format(bufferValue)}ms`;
	if(bufferValue > globalThis.simulation.bufferTime.min){
		timelineBuffer.dataset.status = "good";
	}else if(bufferValue > 0){
		timelineBuffer.dataset.status = "acceptable";
	}else{
		timelineBuffer.dataset.status = "bad";
	}

	bufferedEvents.value = new Intl.NumberFormat().format(globalThis.events.length);
	bufferedEvents.dataset.status = timelineBuffer.dataset.status;

	if(!globalThis.nerdInfoTimeoutSet){
		globalThis.nerdInfoTimeoutSet = true;
		setTimeout(state => {
			globalThis.nerdInfoTimeoutSet = false;
			showNerdInfo(state);
		}, 500, state);
	}

}

/**
 * Logs a message to the "nerd info" box, which can be enabled to debug the simulation.
 *
 * @param {object} data - Data about the message.
 * @param {string} data.message - The message that describes the event.
 * @param {string} data.severity - The severity of the message (info|warning|error).
 * @param {number} data.timestamp - The timestamp for when the event happened.
 */
export async function logMessage({message, severity, timestamp}){
	if(globalThis.settings.nerdInfo === false) return;
	const nerdLog = document.getElementById("nerd-log");
	const log = document.createElement("output");
	log.value = message;
	log.dataset.severity = severity;
	log.dataset.timestamp = timestamp;
	nerdLog.insertBefore(log, nerdLog.firstChild);

	if(severity === "error"){
		globalThis.messages.new({
			type: "error",
			text: "Sorry, there was an error in the simulation. This probably means the simulation won't work as intended.",
		});
	}
}

/**
 * Highlights messages in the "nerd info" box that are relevant to the specific
 * time in the visualization that is currently being shown to the user.
 */
export async function highlightLogs(){
	if(globalThis.settings.simulation?.nerdInfo === false) return;
	const nerdLog = document.getElementById("nerd-log");

	const timestamp = Math.round(globalThis.simulationTime.now / 1000);
	let first = true;
	for(const log of nerdLog.children){
		if(Number(log.dataset.timestamp) === timestamp){
			log.classList.add("highlight");
			if(first){
				log.scrollIntoView();
				first = false;
			}
		}else{
			log.classList.remove("highlight");
		}
	}
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

		// Make sure everything in the UI is aware that something is happening
		globalThis.simulationTime.resume();
		globalThis.timeline.poke(true);
		globalThis.urlState.update();

		// Change the apperance of the button to now be a "pause button"
		button.title = "Pause simulation";
		button.ariaLabel = "Pause simulation";
		button.classList.remove("paused");
	}else{
		// Button was playing, pause playback

		// Make sure everything in the UI is aware that something is happening
		globalThis.simulationTime.pause();
		globalThis.timeline.poke(true);
		globalThis.urlState.update();

		// Change the apperance of the button to now be a "play button"
		button.title = "Play simulation";
		button.ariaLabel = "Play simulation";
		button.classList.add("paused");
	}
});

/**
 * This event listener handles when the user clicks on the reset button in the timeline.
 * The reset button sets the simulation timeline back to 0 and pauses the simulation.
 * It is slightly faster than manually dragging the timeline back.
 */
const resetButton = document.getElementById("reset");
resetButton.addEventListener("click", () => {

	if(!playButton.classList.contains("paused")){
		playButton.click();
	}

	globalThis.simulationTime.reset();
	globalThis.timeline.poke(true);

	resetSimulation(false);
});

/**
 * Set up the necessary classes to run the simulation. You can read more about each class in their respective files.
 */
globalThis.messages = new Messages();
globalThis.urlState = new URLState(controls);
await globalThis.urlState.finished;
globalThis.eventDispatcher = new EventDispatcher();
globalThis.simulationTime = new SimulationTime();
globalThis.eventDrawer = new EventDrawer();
globalThis.timeline = new Timeline();

/**
 * Running `generateInputs` here is what gets the whole app going. It doesn't just generate the controls,
 * but as a side product also generates the initial `globalThis.settings`, which in turn starts the simulation.
 */
generateInputs(controls, globalThis.urlState.restoredSettings, document.getElementById("controls"));



// Append an event listener to the settings button to open/close the settings/controls pane.
const showAndHideButton = document.querySelector("#controls-pane > .toggle");
showAndHideButton.addEventListener("click", () => {
	const controlsPane = document.getElementById("controls-pane");

	controlsPane.classList.toggle("open");
});

// Append an event listener to the "vertical align" button that centers the visualization on screen.
const verticalAlignButton = document.getElementById("vertical-align");
const visualizer = document.getElementById("visualizer");
verticalAlignButton.addEventListener("click", () => {
	visualizer.scrollIntoView({behavior: "smooth"});
});

// Add an event listener that only shows the "vertical align" button when the visualization is not already perfectly aligned.
window.addEventListener(
	"scroll",
	async () => {
		if(Math.abs(visualizer.getBoundingClientRect().y) < 2){
			document.body.classList.add("visualization-in-focus");
		}else{
			document.body.classList.remove("visualization-in-focus");
		}
	},
	{
		passive: true,
	},
);
