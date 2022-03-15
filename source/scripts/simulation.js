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

import { Packet, AddressPacket, NodeData, sendDrawEvent, random, NewBlockSignal } from "./nodeMethods.js";

globalThis.timestamp = 0;

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
			const { process } = await import(`./algorithms/${globalThis.settings.network.algorithms}.js`);
			globalThis.nodeProcess = process;
			globalThis.settings.run = true;
			globalThis.eventQueue.enqueue(new FunctionEvent(addNodes));
			globalThis.eventQueue.enqueue(new FunctionEvent(newBlock, undefined, 5000));
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
	#dequeueStartTime = 0;
	#maxDequeueTime = 3000;

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
		this.#dequeueStartTime = globalThis.timestamp;

		// Go through every event in the queue (as long as the simulation isn't paused)
		while(this.#events.length > 0 && globalThis.settings.run){

			if(globalThis.timestamp - this.#dequeueStartTime > this.#maxDequeueTime){
				setTimeout(() => {globalThis.eventQueue.dequeue();}, 1);
				break;
			}

			// Make sure the queue is sorted chronologically by timestamp
			this.#sort();

			// Take the event out of the queue
			const event = this.#events.shift();
			globalThis.timestamp = event.timestamp;

			// Run the event
			if(event instanceof FunctionEvent){

				event.run?.call(event.with || {});

			}else if (event instanceof NodeEvent){

				// Get the node's data, hand it over to a node process, and then save the modified node data after the data packet has been processed
				const { nodeData, sendPackets } = await globalThis.nodeProcess(
					event.packet,
					globalThis.nodes.get(event.packet.to),
				);

				const lastEnd = nodeData.blockchain.getEnds().at(-1);
				if(lastEnd){
					sendDrawEvent({
						type: "nodeColor",
						address: nodeData.address,
						color: lastEnd.id,
					});
				}

				globalThis.nodes.update(nodeData);

				for(const packet of sendPackets){
					this.enqueue(new NodeEvent(packet, globalThis.timestamp));
				}

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
	 * @param {Packet} packet - The packet to send to the other node.
	 * @param {number} timestamp - When the packet was sent. (NOT when it should be received).
	 */
	constructor(packet, timestamp){
		super(timestamp + packet.delay);
		this.packet = packet;

		if(packet.from !== packet.to){
			sendDrawEvent({
				type: Object.getPrototypeOf(packet).constructor.name,
				delay: packet.delay,
				from: packet.from,
				to: packet.to,
				blockId: packet.block?.id,
				position: {
					to: globalThis.nodes.get(packet.to).position,
					from: globalThis.nodes.get(packet.from).position,
				},
			});
		}

	}
}

/**
 * This is the store of all the node's permanent data, linked to their addresses.
 *
 * Node data is saved here, until a `NodeProcess` with a specific address runs, in which case the data
 * for that address is taken out, and then later delivered back when the `NodeProcess` has altered it.
 */
class Nodes extends Map{

	create(){
		const newNode = new NodeData();
		super.set(newNode.address, newNode);

		sendDrawEvent({
			type: "node",
			address: newNode.address,
			position: newNode.position,
		});

		return newNode.address;
	}

	/**
	 * Save a new/modified data object for a specific node address.
	 *
	 * @param {NodeData} newData - The new data object to save.
	 * @param {number} timestamp - When the data was saved, according to simulation time.
	 *
	 * @returns {Nodes} - This.
	 */
	update(newData){
		// Finally, save the new data.
		return super.set(newData.address, newData);
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
			const address = globalThis.nodes.create();
			this.firstNodes.push(address);
		}
		// Give the 5 nodes each other's addresses
		for(const nodeAddress of this.firstNodes) {
			const addressPacket = new AddressPacket(nodeAddress, nodeAddress, this.firstNodes);
			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	} else {
		// Run when there are already some nodes, to add more nodes procedurally.
		const initialNodesCount = globalThis.nodes.size;
		while (globalThis.nodes.size < Math.min(initialNodesCount + 1, globalThis.settings.network.nodes)) {
			const address = globalThis.nodes.create();
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
 *
 */
function newBlock(){
	const nodeAddresses = [...globalThis.nodes.keys()];
	const findingNodeAddress = nodeAddresses[Math.floor(random(nodeAddresses.length))];

	const newBlockSignal = new NewBlockSignal(findingNodeAddress);

	globalThis.eventQueue.enqueue(new NodeEvent(newBlockSignal, globalThis.timestamp));

	globalThis.eventQueue.enqueue(new FunctionEvent(newBlock, undefined, globalThis.timestamp + 5000));

}

// Initialize the necessary classes and objects to run the simulation
globalThis.settings = {};
globalThis.eventQueue = new EventQueue();
globalThis.nodes = new Nodes();
