
/**
 * @file
 * This file is helps the main UI thread manage the simulation.
 *
 * It is used to manage the underlying simulation which is running in a separate Worker,
 * but is also used to handle the realtime playback of the simulation on the UI thread.
 */

/**
 * Represents the simulation, which is running in a separate Worker.
 * When the class is constructed, it automatically starts a Worker thread and passes the appropriate settings to it.
 */

import { resetSimulation } from "./ui.js";
export class Simulation extends Worker{

	/**
	 * Represents the simulation, which is running in a separate Worker.
	 * When the class is constructed, it automatically starts a Worker thread and passes the appropriate settings to it.
	 */
	constructor(){

		// Start the Worker with the simulation code
		super("./scripts/simulation.js", { type: "module" });

		/**
		 * This function handles all messages that are returned from the simulation.
		 * The simulation only responds with draw events.
		 *
		 * @param {object} event - The draw event.
		 */
		this.onmessage = event => {

			// Save the draw event to the global event array.
			globalThis.events.push(event.data);

			// Pause the simulation if the returned draw event is too far in the future.
			if(event.data.timestamp > globalThis.simulationTime.now + this.#bufferTime.max) this.pause();

			// Make sure the `eventDispatcher` is running to handle this new event.
			globalThis.eventDispatcher.poke();

		};
		this.onerror = event => {
			globalThis.messages.new({
				type: "error",
				text: "Sorry, there was an unexpected error in the simulation. This probably means the simulation won't work as intended.",
			});
			throw event;
		};

		// Send the command to start the simulation, and pass the `globalThis.settings` element.
		this.postMessage({ message: "start", settings: globalThis.settings });
	}

	/**
	 * `bufferTime` is a read-only representation of when the simulation should pause/resume.
	 * The real simulation runs very fast, and can quickly be creating events that are several
	 * minutes ahead of the realtime simulation being displayed to the user.
	 *
	 * Therefore, in order to save CPU cycles, `bifferTime.max` tells the simulation that when
	 * it starts creating events that are more than `bufferTime.max` milliseconds ahead of the
	 * current realime playback, it should pause the simulation.
	 * `bufferTime.min` is the point at which the simulation should start again, because we are
	 * running out of events to show in realtime.
	 */
	#bufferTime = {
		min: 3000,
		max: 10000,
	};
	get bufferTime(){
		return this.#bufferTime;
	}

	/**
	 * Sends a command that pauses the simulation.
	 */
	pause(){
		if(!this.#paused){
			this.postMessage({ message: "pause" });
			this.#paused = true;
		}
	}

	/**
	 * Sends a command that resumes the simulation.
	 */
	resume(){
		if(this.#paused){
			this.postMessage({ message: "resume" });
			this.#paused = false;
		}
	}

	#paused = false;
}

/**
 * Represents the realtime playback of the simulation.
 * The simulation time can at any point be accessed with `SimulationTime.now`.
 *
 * The time can be pasued/resumed, and can also be sped up or slowed down.
 */
export class SimulationTime{
	/**
	 * Represents the realtime playback of the simulation.
	 * The simulation time can at any point be accessed with `SimulationTime.now`.
	 *
	 * The time can be pasued/resumed, and can also be sped up or slowed down.
	 */
	constructor(){
		this.reset(globalThis.urlState.restoredTime);
	}

	// The timestamp in real time, where the simulation time was started.
	#startTime = 0;

	// The timestamp in real time, where the simulation time was paused.
	#pausedTime = 0;

	#paused = true;
	get paused(){
		return this.#paused;
	}

	/**
	 * Resets the simulation time to 0 and pauses it.
	 *
	 * @param time
	 */
	reset(time = 0){
		this.#paused = true;
		const realNow = Date.now();
		this.#startTime = realNow - time;
		this.#pausedTime = realNow;
	}

	/**
	 * Pauses the simulation.
	 *
	 * In reality, it just sets a timestamp of when the simulation was paused,
	 * and lets other functions handle how to translate that to a paused time.
	 */
	pause(){
		if(!this.#paused){
			this.#pausedTime = Date.now();
			this.#paused = true;
		}
	}

	/**
	 * Resumes the simulation time.
	 *
	 * This is done by calculating the time since the simulation was paused, and adding that time the start time.
	 */
	resume(){
		if(this.#paused){
			this.#startTime += Date.now() - this.#pausedTime;
			this.#paused = false;

			// Make sure the `eventDispatcher` is aware that time is now running again.
			globalThis.eventDispatcher.poke();
		}
	}

	/**
	 * Returns the current timestamp of the realtime simulation playback.
	 *
	 * @returns {number} - The current timestamp of the simulation time.
	 */
	get now(){

		const realNow = Date.now();

		// Calculate the time between when the simulation was started and now (in real time),
		const playTime = realNow - this.#startTime;

		if(this.#paused){

			// If the time is paused, return the playtime, but subtract the time since the simulation was paused.
			return playTime - (realNow - this.#pausedTime);

		}else{

			// If the time is running, simply return the calculated playtime.
			return playTime;

		}
	}

	set now(value){
		const reset = Boolean(value < this.now);

		const realNow = Date.now();

		this.#startTime = realNow - value;
		this.#pausedTime = realNow;

		if(reset) resetSimulation(false);
		globalThis.eventDispatcher.poke();
	}
}

/**
 * Handles the list of draw events, and dispatches draw events when they are supposed to be dispatched
 * according to their timestamp, and the current simulation time.
 */
export class EventDispatcher{
	/**
	 * Handles the list of draw events, and dispatches draw events when they are supposed to be dispatched
	 * according to their timestamp, and the current simulation time.
	 */
	constructor(){
		this.reset();
	}

	// The index in the vent list, of the next event to be dispatched. All elements before this index have already been dispatched.
	#nextEvent = 0;

	/**
	 * Resets the dispatcher, as if the app was just opened.
	 */
	reset(){
		this.#nextEvent = 0;
	}

	/**
	 * When other functions think that there might be new events to dispatch, they can `poke` this eventDispatcher,
	 * after which it will make sure that any events that should be dispatched, are dispatched.
	 *
	 * Because there can be many simultaneous calls to this function, it has a method to make sure that only one instance
	 * of it is running at any given time. If a new instance of it is started while a different instance is already
	 * running, then the new instance will quickly terminate itself.
	 */
	async poke(){
		let event = globalThis.events[this.#nextEvent];

		// If there are almost no events left in the events array, then tell the simulation to produce some more.
		if(
			!event ||
			!globalThis.events[this.#nextEvent + 10] ||
			globalThis.events.at(-1).timestamp - globalThis.simulationTime.now < globalThis.simulation.bufferTime.min
		){
			globalThis.simulation.resume();
		}

		// If a different instance is already running, or there are no events left, terminate.
		// Otherwise, make it known that this instance is now running.
		if(this.#running || !event) return;
		this.#running = true;

		if(globalThis.urlState.lastUpdate < Date.now() - globalThis.urlState.timelineUpdateFrequency){
			globalThis.urlState.update();
		}

		/**
		 * Loop through all events with a timestamp that is after the current simulation time.
		 *
		 * Ideally, the event timestamps should only be a few milliseconds behind the simulation
		 * time, making it seem like the events are dispatched exactly when they're supposed to.
		 * This is achieved by calling `poke` whenever there is the slightest chance that we have
		 * reached the timestamp of an event.
		 */
		while(event && event.timestamp < globalThis.simulationTime.now){

			// Tell the `eventDrawer` to draw the event in the UI.
			globalThis.eventDrawer.draw(event);

			// Prepare the next event
			this.#nextEvent++;
			event = globalThis.events[this.#nextEvent];
		}

		/**
		 * Set a timer to run this function again right after the timestamp of the next event.
		 *
		 * This assumes a few things. It for example assumes that the user doesn't pause or
		 * alter the speed of the simulation up until the next draw event. But that is fine,
		 * other functions will make sure to `poke` the function in those cases, allowing it
		 * to run and set a new timeout.
		 */
		if(event && !globalThis.simulationTime.paused){
			setTimeout(() => {globalThis.eventDispatcher.poke();}, (event.timestamp - globalThis.simulationTime.now) + 1);
		}

		// Make it known that there are no longer any instances of this function running.
		this.#running = false;
	}

	#running = false;
}

/**
 * Handles UI draw events and transforms them into the actual DOM elements displayed on screen.
 *
 * In order to do this, it saves an internal representation of each element being drawn on screen,
 * and then it maniuplates those elements basd on what the draw event commends.
 */
export class EventDrawer{

	#nodes = new Map();
	#connections = new Map();
	#blocks = new Map();
	#networkBox = document.querySelector("#visualizer .network");
	#chainBox = document.querySelector("#visualizer .blockchain");

	/**
	 * This function is called to take a UI draw event and create the actual DOM elements displayed on screen, according to the event.
	 *
	 * @param {object} event - The UI draw event.
	 */
	async draw(event){
		switch(event.type){
			case "node": {
				if(event.active){
					const node = document.createElement("div");
					node.classList.add("node");
					node.style.top = `${event.position.y * 100}%`;
					node.style.left = `${(event.position.x / globalThis.settings.networkBoxRatio) * 100}%`;

					this.#networkBox.appendChild(node);
					this.#nodes.set(event.address, node);
				}else{
					const node = this.#nodes.get(event.address);
					node.classList.add("inactive");
				}
				break;
			}
			case "nodeColor": {

				const node = this.#nodes.get(event.address);

				let combinedTrust = 0;
				for(const color of event.colors) combinedTrust += color.trust;
				const ratio = combinedTrust > 0 ? 360 / combinedTrust : 0;

				const gradients = [];
				let trustDegrees = 0;
				for(const color of event.colors){
					const start = trustDegrees * ratio;
					trustDegrees += color.trust;
					const end = trustDegrees * ratio;
					gradients.push(`${color.color} ${start}deg ${end}deg`);
				}

				node.style.background = `conic-gradient(${gradients.join(",")})`;
				break;
			}
			case "connection": {
				if(event.active){
					const connection = document.createElement("div");
					connection.classList.add("connection");
					connection.style.top = `${event.position.y * 100}%`;
					connection.style.left = `${event.position.x * 100}%`;
					connection.style.setProperty("--length", `${event.length * 100}%`);
					connection.style.transform = `rotate(${event.slope}deg)`;

					this.#networkBox.appendChild(connection);
					this.#connections.set(event.id, connection);
				}else{
					const connection = this.#connections.get(event.id);
					connection.remove();
				}
				break;
			}
			case "AddressPacket": {
				if(event.timestamp + event.delay < globalThis.simulationTime.now) break;
				const packet = document.createElement("div");
				packet.classList.add("packet");
				packet.classList.add("AddressPacket");

				const delay = event.delay;

				packet.style.top = `${event.position.from.y * 100}%`;
				packet.style.left = `${(event.position.from.x / globalThis.settings.networkBoxRatio) * 100}%`;
				packet.style.transitionDuration = `${delay}ms`;

				this.#networkBox.appendChild(packet);

				setTimeout((packet, position) => {
					packet.style.top = `${position.y * 100}%`;
					packet.style.left = `${(position.x / globalThis.settings.networkBoxRatio) * 100}%`;
				}, 1, packet, event.position.to);
				setTimeout(packet => {packet.remove();}, delay + 1000, packet);

				break;
			}
			case "BlockPacket": {
				if(event.timestamp + event.delay < globalThis.simulationTime.now) break;
				const packet = document.createElement("div");
				packet.classList.add("packet");
				packet.classList.add("BlockPacket");

				const delay = event.delay;

				packet.style.top = `${event.position.from.y * 100}%`;
				packet.style.left = `${(event.position.from.x / globalThis.settings.networkBoxRatio) * 100}%`;
				packet.style.transitionDuration = `${delay}ms`;
				packet.style.setProperty("--id", event.blockId);

				this.#networkBox.appendChild(packet);

				setTimeout((packet, position) => {
					packet.style.top = `${position.y * 100}%`;
					packet.style.left = `${(position.x / globalThis.settings.networkBoxRatio) * 100}%`;
				}, 1, packet, event.position.to);
				setTimeout(packet => packet.remove(), delay + 1000, packet);

				break;
			}
			case "chainUpdate": {

				this.#updateChain(event);

			}
		}
	}

	#updateChain(event){

		this.#chainBox.style.setProperty("--block-size", `${event.blockSize}%`);

		for(const blockEvent of event.events){
			switch(blockEvent.action){
				case "remove": {
					const block = this.#blocks.get(blockEvent.id);
					block.remove();
					this.#blocks.delete(blockEvent.id);
					break;
				}
				case "add": {
					const block = document.createElement("div");
					block.classList.add("block");
					block.style.setProperty("--id", blockEvent.id);
					block.style.setProperty("--trust", blockEvent.trust);
					block.style.top = `${blockEvent.top}%`;
					block.style.left = `${blockEvent.left}%`;
					this.#chainBox.appendChild(block);
					this.#blocks.set(blockEvent.id, block);
					break;
				}
				case "update": {
					const block = this.#blocks.set(blockEvent.id);
					console.log(block);
					if(blockEvent.trust !== undefined){
						block.style.setProperty("--trust", blockEvent.trust);
					}
					if(blockEvent.top !== undefined){
						block.style.top = `${blockEvent.top}%`;
					}
					if(blockEvent.left !== undefined){
						block.style.left = `${blockEvent.left}%`;
					}
					break;
				}
			}
		}

	}
}
