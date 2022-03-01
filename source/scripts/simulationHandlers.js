
/**
 * @file
 */



export class Simulation extends Worker{
	constructor(){
		super("scripts/simulation.js", { type: "module" });
		this.onmessage = event => {
			globalThis.events.push(event.data);

			if(event.data.timestamp > globalThis.simulationTime.now + this.bufferTime.max) this.pause();

			globalThis.eventDispatcher.poke();
		};
		this.postMessage({ message: "start", settings: globalThis.settings });
	}
	bufferTime = {
		min: 3000,
		max: 10000,
	};
	#paused = false;
	pause(){
		if(!this.#paused){
			this.postMessage({ message: "pause" });
			this.#paused = true;
		}
	}
	resume(){
		if(this.#paused){
			this.postMessage({ message: "resume" });
			this.#paused = false;
		}
	}
}

export class SimulationTime{
	constructor(){
		this.reset();
	}
	#startTime = 0;
	#pausedTime = 0;
	#paused = true;
	reset(){
		this.#paused = true;
		this.#startTime = Date.now();
		this.#pausedTime = Date.now();
	}
	pause(){
		this.#pausedTime = Date.now();
		this.#paused = true;
	}
	resume(){
		this.#startTime += Date.now() - this.#pausedTime;
		this.#paused = false;
		globalThis.eventDispatcher.poke();
	}
	get now(){
		if(this.#paused){
			return Date.now() - this.#startTime - (Date.now() - this.#pausedTime);
		}else{
			return Date.now() - this.#startTime;
		}
	}
}

export class EventDispatcher{
	constructor(){
		this.reset();
	}
	#nextEvent = 0;
	#running = false;
	reset(){
		this.#nextEvent = 0;
	}
	async poke(){
		let event = globalThis.events[this.#nextEvent];

		//If there are almost no events left in the events array, then tell the simulation to produce some more
		if(
			!event ||
			!globalThis.events[this.#nextEvent + 10] ||
			globalThis.events[globalThis.events.length - 1].timestamp - globalThis.simulationTime.now < globalThis.simulation.bufferTime.min
		){
			globalThis.simulation.resume();
		}

		if(this.#running || !event) return;
		this.#running = true;

		while(event && event.timestamp < globalThis.simulationTime.now){

			globalThis.eventDrawer.draw(event);

			this.#nextEvent++;
			event = globalThis.events[this.#nextEvent];
		}

		if(event){
			setTimeout(() => {globalThis.eventDispatcher.poke()}, (event.timestamp - globalThis.simulationTime.now) + 1);
		}

		this.#running = false;
	}
}
