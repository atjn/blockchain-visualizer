/**
 * @file
 * This file runs the actual simulation. It runs in a Worker, and simply posts a long chronological list of events that the UI should draw.
 *
 * The simulation usually runs much faster than realtime, but adds timestamps to each event,
 * so that the UI knows when to draw each event in accordance with the playback speed.
 *
 * Internally, the simulation works by having an event queue that stores all events that haven't been processed yet.
 * Whenever a node wants to send data to another node, it creates an event in the queue, in which the other node receives that data.
 * Then, the other node is spun up to receive and process the data,
 * after which it will probably create more events for other nodes to receive data.
 *
 * All events have timestamps to keep track of the network delay between a packet being send and a packet being received,
 * but all events are processed as fast as possible, and the timestamp is just used by the UI when it does realtime playback.
 *
 * The internal event queue is not the same as the events this simulation sends to the UI.
 * The internal queue denote the actual data that is being sent between nodes,
 * whereas the UI events are strictly designed to tell the UI what to draw on the screen, and when.
 */

/**
 * Handles messages being sent by the UI.
 *
 * @param {Event} event - The message sent by the UI thread.
 */
onmessage = async function (event){
	switch (event.data.message) {
		// Start the simulation by sending the `globalThis.settings` object from the UI controls.
		case "start": {
			globalThis.settings = event.data.settings;
			globalThis.settings.run = true;
			globalThis.eventQueue.enqueue(new FunctionEvent(addNodes));
			break;
		}
		// If the simulation is way ahead of the realtime playback, a `pause` command can be send to temporarily pause the simulation.
		case "pause": {
			globalThis.settings.run = false;
			break;
		}
		// Then when the realtime playback is running out of events, a `resume` commands can be send to start receiving new events again.
		case "resume": {
			globalThis.settings.run = true;
			globalThis.eventQueue.dequeue();
			break;
		}
	}
};

/**
 * The queue of events that haven't been processed yet.
 */
class EventQueue{
	#events = [];
	#isSorted = true;
	#dequeueing = false;

	/**
	 * Sorts the events by timestamp, meaning the next event is always first in line.
	 * When dequeueng events, it is very important that they happen in the right order.
	 */
	#sort(){
		// `this.#isSorted` is a small performance optimisation. Why sort the list again if we know it has already been sorted.
		// `this.#isSorted` is set to false whenever new events get enqueued.
		if(!this.#isSorted){
			this.#events.sort((a, b) => a.timestamp - b.timestamp);
			this.#isSorted = true;
		}
	}

	/**
	 * Run this function to add a new event or an array of new events to the queue.
	 *
	 * @param {(Event|Event[])} newEvents - The new event/s to add to the queue.
	 */
	async enqueue(newEvents){
		if(!Array.isArray(newEvents)) newEvents = [newEvents];
		this.#events.push(...newEvents);

		// Make sure `dequeue` is aware that the list might no longer be sorted
		this.#isSorted = false;

		// Run dequeue in case it wasn't already running, so it can check out this new event.
		this.dequeue();
	}

	/**
	 * Takes events out of the queue and runs them.
	 *
	 * This function is called on many occassions to make sure events are processed whenever possible,
	 * and can often be called so many times that several copies of it could run simultaneously. That is not good,
	 * since the events should be processed in chronological order, so therefore the function is designed to instantly
	 * die if another copy is already running.
	 */
	async dequeue(){
		// If another version already runs, quit instantly. Otherwise make it known that this isntance is now running.
		if(this.#dequeueing) return;
		this.#dequeueing = true;

		// Go through every event in the queue (as long as the simulation isn't paused)
		while(this.#events.length > 0 && globalThis.settings.run){

			// Make sure the queue is sorted chronologically by timestamp
			this.#sort();

			// Take the event out of the queue
			const event = this.#events.shift();

			// Run the event
			if(event instanceof FunctionEvent){

				event.run?.call(event.with || {});

			}else if (event instanceof NodeEvent){

				// Get the nodes storage, hand it over to a node process, and then save the modified node storage after the data packet has been processed
				const process = new NodeProcess({
					packet: event.data,
					storage: globalThis.nodes.get(event.data.to),
				});
				globalThis.nodes.set(event.data.to, await process.result, event.timestamp);

			}

		}

		// Make it known that no instances of `dequeue` are running anymore
		this.#dequeueing = false;
	}
}

/**
 * A generic event that can be added to the EventQeue.
 */
class SimulationEvent{
	/**
	 * A generic event that can be added to the EventQeue.
	 *
	 * @param {number} timestamp - When the event should occur.
	 */
	constructor(timestamp = 0){
		this.timestamp = timestamp;
	}
}

new SimulationEvent();

/**
 * A FunctionEvent denotes that a certain simulation-related function should run at a certain time in the simulation.
 * This is for example used to run `addNodes`, which gradually adds more nodes to the simulation at specific points in time.
 */
class FunctionEvent extends SimulationEvent{
	/**
	 * A FunctionEvent denotes that a certain simulation-related function should run at a certain time in the simulation.
	 * This is for example used to run `addNodes`, which gradually adds more nodes to the simulation at specific points in time.
	 *
	 * @param {object} run - The function to run.
	 * @param {object} runWith - Which context it should run in.
	 * @param {number} timestamp - When it should run.
	 */
	constructor(run, runWith, timestamp){
		super(timestamp);
		this.run = run;
		this.with = runWith;
	}
}

/**
 * A NodeEvent denotes that one node has sent some sort of packet to another node.
 */
class NodeEvent extends SimulationEvent{
	/**
	 * A NodeEvent denotes that one node has sent some sort of packet to another node.
	 *
	 * @param {Packet} data - The data packet to send to the other node.
	 * @param {number} timestamp - When the packet was sent. (NOT when it should be received).
	 */
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

/**
 * Represents a node that is processing some new data that it has received.
 *
 * Under-the-hood, this class spins up a Worker with the chosen algorithm,
 * which is responsible for processing the data packet, and then returns its storage before it is terminated.
 */
class NodeProcess{
	/**
	 * Represents a node that is processing some new data that it has received.
	 *
	 * Under-the-hood, this class spins up a Worker with the chosen algorithm,
	 * which is responsible for processing the data packet, and then returns its storage before it is terminated.
	 *
	 * @param {Packet} data - The data packet to process.
	 */
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

/**
 * A repersentation of each node's permanent storage.
 * This is where the node saves the blockchain it is aware of, along with other node addresses and so forth.
 *
 * This is theoretically just an object where the node can save anything it wants,
 * but it should save certain things in certain places, so that the simulation knows what is going on.
 *
 * The storage also holds a few values that the simulation uses. Ine example is the x and y coordinates for the node's position.
 */
class NodeStorage{
	constructor(){
		this.position.y = random();
		this.position.x = random(globalThis.settings.networkBoxRatio);
	}
	position = {};
	nodeAddresses = [];
}

/**
 * This is the store of all the node's permanent storage, linked to their addresses.
 *
 * Node storage is saved here, until a `NodeProcess` with a specific address runs, in which case the storage
 * for that address is taken out, and then later delivered back when the `NodeProcess` has altered it.
 *
 * When the storage is delivered back, this class checks if there are any changes, and if so, send appropriate draw events to the UI thread.
 */
class Nodes extends Map{
	constructor(){
		super();
	}

	/**
	 * Save a new/modified storage for a specific node address.
	 *
	 * @param {number} address - The address of the node tha towns the storage.
	 * @param {NodeStorage} newStorage - The new storage object to save.
	 * @param {number} timestamp - When the storage was saved, according to simulation time.
	 *
	 * @returns {Nodes} - This.
	 */
	set(address, newStorage, timestamp){
		// Get the storage as it was, in order to compare for differences
		const oldStorage = super.get(address);

		if(oldStorage){

			// Check if any new node addresses have been added. If so, send a draw event for a new connection.
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

			// Check if any node addresses have been removed. If so, send a draw event for a removed connection.
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
			/**
			 * If this is the first time storage has been saved to this address,
			 * then it means this is a new node. Send a draw event for a new node.
			 */
			postMessage({
				type: "node",
				timestamp,
				active: true,
				address,
				position: newStorage.position,
			});
		}

		// Save the new storage.
		return super.set(address, newStorage);
	}

}

/**
 * A generic packet of data that can be send from a node to a node.
 */
class Packet{
	/**
	 * A generic packet of data that can be send from a node to a node.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the that send the packet.
	 */
	constructor(to, from){
		this.to = to;
		this.from = from;

		// Compute the length between the two nodes
		const { position: fromPosition } = globalThis.nodes.get(from);
		const { position: toPosition } = globalThis.nodes.get(to);
		this.distance = distance(fromPosition, toPosition);

		// Compute the delay of the packet based on the length between nodes
		this.delay = this.distance * globalThis.settings.network.speed;

	}
}

/**
 * An AddressPacket represents a data packet with node addresses in it.
 */
class AddressPacket extends Packet{
	/**
	 * An AddressPacket represents a data packet with node addresses in it.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the that send the packet.
	 * @param {(number|number[])} addresses - The list of other node addresses to deliver.
	 */
	constructor(to, from, addresses){
		super(to, from);
		this.addresses = Array.isArray(addresses) ? addresses : [];
	}
}

/**
 * Procedurally adds the specified amount of nodes to the visualization.
 *
 * Nodes are not all added instantaneously, because it makes much more
 * sense to slowly add them and see how the network handles the new structure.
 *
 * Therefore, this function is designed to be called and run several times,
 * and the first time it runs, it runs a completely different code path.
 */
async function addNodes(){

	// These will be undefined only the first time the function is called
	this.firstNodes ??= [];
	this.timestamp ??= 0;

	if (this.firstNodes.length === 0) {
		// Run when there are no nodes add at all yet. Establish 5 central nodes that other nodes have hardcoded addresses to (`firstNodes`).
		while (globalThis.nodes.size < Math.min(5, globalThis.settings.network.nodes)) {
			const address = newAddress();
			this.firstNodes.push(address);
			globalThis.nodes.set(address, new NodeStorage(), this.timestamp);
		}
		// Give the 5 nodes each other's addresses
		for(const nodeAddress of this.firstNodes) {
			const addressPacket = new AddressPacket(nodeAddress, nodeAddress, this.firstNodes);
			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	} else {
		// Run when there are already some nodes, to add more nodes procedurally.
		const initialNodesCount = globalThis.nodes.size;
		while (globalThis.nodes.size < Math.min(initialNodesCount + 5, globalThis.settings.network.nodes)) {
			const address = newAddress();
			globalThis.nodes.set(address, new NodeStorage(), this.timestamp);
			const addressPacket = new AddressPacket(address, address, this.firstNodes);

			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	}

	// If there are still more nodes to be added, then enqueue a function event for `addNodes` to continue after a small timeout.
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
 * Hands out new node addresses.
 * The addresses are just numbers that count up, for our purposes, it is a fine id.
 *
 * @returns {number} - A new unique node address.
 */
function newAddress(){
	globalThis.rollingAddress ??= 0;
	globalThis.rollingAddress++;
	return globalThis.rollingAddress;
}

/**
 * Outputs a random number between 0 and `max` generated from the global seed.
 * If the same seed is used between runs, the generator will always produce the exact same sequence of "random" values.
 *
 * This specific implementation of a number generator is called mulberry32.
 *
 * @param {number} max - The maximum number allowed. (the minimum is always 0).
 *
 * @returns {number} - A random number between 0 and `max`.
 */
function random(max = 1){
	globalThis.rs ??= globalThis.settings.seed;
	/* eslint-disable-next-line */
	let t; return max*((globalThis.rs=globalThis.rs+1831565813|0,t=Math.imul(globalThis.rs^globalThis.rs>>>15,1|globalThis.rs),t=t+Math.imul(t^t>>>7,61|t)^t,(t^t>>>14)>>>0)/2**32);
}

/**
 * Calculates the distance between two nodes.
 *
 * @param {object} root0 - Position of node 1.
 * @param {number} root0.x - Horizontal position of node 1.
 * @param {number} root0.y - Vertical position of node 1.
 * @param {object} root1 - Position of node 2.
 * @param {number} root1.x - Horizontal position of node 2.
 * @param {number} root1.y - Vertical position of node 2.
 * @param {boolean} useBoxRatio - If true, returns a number that is compatible with the UI positions of the nodes. Otherwise it is compatible with the simulation positions.
 *
 * @returns {number} - The distance between the two nodes.
 */
function distance({x: x1, y: y1}, {x: x2, y: y2}, useBoxRatio = false){
	// Using Pythagora's sentence a²+b²=c²
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
 * Calculates the middle position between two nodes.
 *
 * @param {object} root0 - Position of node 1.
 * @param {number} root0.x - Horizontal position of node 1.
 * @param {number} root0.y - Vertical position of node 1.
 * @param {object} root1 - Position of node 2.
 * @param {number} root1.x - Horizontal position of node 2.
 * @param {number} root1.y - Vertical position of node 2.
 * @param {boolean} useBoxRatio - If true, returns a position that is compatible with the UI positions of the nodes. Otherwise it is compatible with the simulation positions.
 *
 * @returns {object} - The position of the middle point between the two nodes.
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
 * Calculate the slope of a connection between two nodes.
 *
 * @param {object} root0 - Position of node 1.
 * @param {number} root0.x - Horizontal position of node 1.
 * @param {number} root0.y - Vertical position of node 1.
 * @param {object} root1 - Position of node 2.
 * @param {number} root1.x - Horizontal position of node 2.
 * @param {number} root1.y - Vertical position of node 2.
 *
 * @returns {number} - The slope of the connection in degrees.
 */
function slope({x: x1, y: y1}, {x: x2, y: y2}){

	// First get the slope as a fraction
	const slopeFraction = (y1 - y2) / (x1 - x2);

	// Now convert from fraction to degrees
	return Math.atan(slopeFraction) * (180 / Math.PI);

}

// Initialize the necessary classes and objects to run the simulation
globalThis.settings = {};
globalThis.eventQueue = new EventQueue();
globalThis.nodes = new Nodes();
