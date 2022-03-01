/**
 * @file
 * This is the simulation file.
 */

class EventQueue{
	async enqueue(newEvents){
		if(!Array.isArray(newEvents)) newEvents = [newEvents];
		this.#events.push(...newEvents);
		this.#isSorted = false;
		this.dequeue();
	}
	#events = [];
	#isSorted = true;
	#dequeueing = false;
	async dequeue(){
		if(this.#dequeueing) return;
		this.#dequeueing = true;

		while(this.#events.length > 0 && globalThis.settings.run){

			if(!this.#isSorted) this.#events.sort((a, b) => a.timestamp - b.timestamp);

			const event = this.#events.shift();

			if(event instanceof FunctionEvent){
				event.run?.call(event.with || {});
			}else if (event instanceof NodeEvent){
				const process = new NodeProcess({
					packet: event.data,
					storage: globalThis.nodes.get(event.data.to),
				});
				globalThis.nodes.set(event.data.to, await process.result, event.timestamp);
			}

		}

		this.#dequeueing = false;
	}
}

class Event{
	constructor(timestamp = 0){
		this.timestamp = timestamp;
	}
}

class FunctionEvent extends Event{
	constructor(run, runWith, timestamp){
		super(timestamp);
		this.run = run;
		this.with = runWith;
	}
}

class NodeEvent extends Event{
	constructor(data, timestamp){
		super(timestamp + data.delay);
		this.data = data;

		if(data.from !== data.to){
			postMessage({
				type: Object.getPrototypeOf(data).constructor.name,
				timestamp,
				delay: data.delay,
				from: data.from,
				to: data.to,
			});
		}

	}
}

class NodeProcess{
	constructor(data){
		this.#worker = new Worker(`./algorithms/${globalThis.settings.network.algorithms}.js`, { type: "module" });
		this.#worker.postMessage(data);
		this.#result = new Promise((resolve, reject) => {
			this.#worker.onmessage = event => {
				this.#worker.terminate();
				resolve(event.data);
			};
			this.#worker.onerror = event => {
				this.#worker.terminate();
				reject(event);
			};
		});
	}
	#worker;
	#result;
	get result(){
		return this.#result;
	}
}

class NodeStorage{
	constructor(){
		this.position.y = random();
		this.position.x = random(globalThis.settings.networkBoxRatio);
	}
	position = {};
	nodeAddresses = [];
}

class Nodes extends Map{
	set(address, newStorage, timestamp){
		const oldStorage = super.get(address);

		if(oldStorage){
			for(const peerAddress of newStorage.nodeAddresses){
				if(peerAddress === address) continue;
				if(!oldStorage.nodeAddresses.includes(peerAddress)){
					const fromPosition = newStorage.position;
					const toPosition = super.get(peerAddress).position;
					postMessage({
						type: "connection",
						timestamp,
						active: true,
						id: `${address}-${peerAddress}`,
						length: distance(fromPosition, toPosition, true),
						slope: slope(fromPosition, toPosition),
						position: middle(fromPosition, toPosition, true),
					});
				}
			}

			for(const peerAddress of oldStorage.nodeAddresses){
				if(peerAddress === address) continue;
				if(!newStorage.nodeAddresses.includes(peerAddress)){
					postMessage({
						type: "connection",
						timestamp,
						active: false,
						id: `${address}-${peerAddress}`,
					});
				}
			}
		}else{
			postMessage({
				type: "node",
				timestamp,
				active: true,
				address,
				position: newStorage.position,
			});
		}

		return super.set(address, newStorage);
	}
}

class Packet{
	constructor(to, from){
		this.to = to;
		this.from = from;

		//Compute length between the two nodes
		const { position: fromPosition } = globalThis.nodes.get(from);
		const { position: toPosition } = globalThis.nodes.get(to);
		this.distance = distance(fromPosition, toPosition);

		//Compute delay of the packet
		this.delay = this.distance * globalThis.settings.network.speed;

	}
}

class AddressPacket extends Packet{
	constructor(to, from, addresses){
		super(to, from);
		this.addresses = Array.isArray(addresses) ? addresses : [];
	}
}

/**
 * Outputs a random number between 0 and {max} generated from the global seed.
 * If the same seed is used between runs, the generator will always produce the exact same sequence of "random" values.
 *
 * This specific implementation of a number generator is called mulberry32.
 *
 * @param {number} max - The maximum number allowed. (the minimum is always 0).
 * @returns {number} - A random number between 0 and {max}.
 */
function random(max = 1){
	globalThis.rs ??= globalThis.settings.seed;
	/* eslint-disable-next-line */
	let t; return max*((globalThis.rs=globalThis.rs+1831565813|0,t=Math.imul(globalThis.rs^globalThis.rs>>>15,1|globalThis.rs),t=t+Math.imul(t^t>>>7,61|t)^t,(t^t>>>14)>>>0)/2**32);
}

globalThis.settings = {};
globalThis.eventQueue = new EventQueue();
globalThis.nodes = new Nodes();


/**
 * Procedurally adds the specified amount of nodes to the visualization.
 */
async function addNodes(){
	this.firstNodes ??= [];
	this.timestamp ??= 0;

	if (this.firstNodes.length === 0) {
		while (globalThis.nodes.size < Math.min(5, globalThis.settings.network.nodes)) {
			const address = newAddress();
			this.firstNodes.push(address);
			globalThis.nodes.set(address, new NodeStorage(), this.timestamp);
		}
		for(const nodeAddress of this.firstNodes) {
			const addressPacket = new AddressPacket(nodeAddress, nodeAddress, this.firstNodes);
			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	} else {
		const initialNodesCount = globalThis.nodes.size;
		while (globalThis.nodes.size < Math.min(initialNodesCount + 5, globalThis.settings.network.nodes)) {
			const address = newAddress();
			globalThis.nodes.set(address, new NodeStorage(), this.timestamp);
			const addressPacket = new AddressPacket(address, address, this.firstNodes);

			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	}

	if (globalThis.nodes.size < globalThis.settings.network.nodes) {
		const nextTimestamp = this.timestamp + 6000;
		globalThis.eventQueue.enqueue(
			new FunctionEvent(
				addNodes,
				{
					firstNodes: [...this.firstNodes],
					timestamp: nextTimestamp,
				},
				nextTimestamp,
			),
		);
	}
}

/**
 *
 */
function newAddress(){
	globalThis.rollingAddress ??= 0;
	globalThis.rollingAddress++;
	return globalThis.rollingAddress;
}

/**
 * @param {object} root0
 * @param {number} root0.x
 * @param {number} root0.y
 * @param {object} root1
 * @param {number} root1.x
 * @param {number} root1.y
 * @param useBoxRatio
 */
function distance({x: x1, y: y1}, {x: x2, y: y2}, useBoxRatio = false){
	if(useBoxRatio){
		return (Math.sqrt(
			((x1 - x2) ** 2) +
			((y1 - y2) ** 2),
		) / globalThis.settings.networkBoxRatio);
	}else{
		return Math.sqrt(
			((x1 - x2) ** 2) +
			((y1 - y2) ** 2),
		);
	}
}

/**
 * @param {object} root0
 * @param {number} root0.x
 * @param {number} root0.y
 * @param {object} root1
 * @param {number} root1.x
 * @param {number} root1.y
 * @param useBoxRatio
 */
function middle({x: x1, y: y1}, {x: x2, y: y2}, useBoxRatio = false){
	if(useBoxRatio){
		return {
			x: ((x1 + x2) / 2) / globalThis.settings.networkBoxRatio,
			y: (y1 + y2) / 2,
		};
	}else{
		return {
			x: (x1 + x2) / 2,
			y: (y1 + y2) / 2,
		};
	}
}

/**
 * @param {object} root0
 * @param {number} root0.x
 * @param {number} root0.y
 * @param {object} root1
 * @param {number} root1.x
 * @param {number} root1.y
 */
function slope({x: x1, y: y1}, {x: x2, y: y2}){
	const slopeFraction = (y1 - y2) / (x1 - x2);
	//Now convert from fraction to degrees
	return Math.atan(slopeFraction) * (180 / Math.PI);
}

onmessage = async function (e){
	switch (e.data.message) {
		case "start": {
			globalThis.settings = e.data.settings;
			globalThis.settings.run = true;
			globalThis.eventQueue.enqueue(new FunctionEvent(addNodes));
			break;
		}
		case "pause": {
			globalThis.settings.run = false;
			break;
		}
		case "resume": {
			globalThis.settings.run = true;
			globalThis.eventQueue.dequeue();
			break;
		}
	}
};
