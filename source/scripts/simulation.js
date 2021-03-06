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
 * whereas the UI events are strictly designed to tell the UI what and when to draw on the screen.
 */

import { AddressPacket, sendDrawEvent, random, NewBlockSignal, BlockChain, sendErrorEvent, sendLogEvent } from "./nodeMethods.js";
import { average, clampMin } from "./utilities.js";
import { Nodes } from "./simulationMethods.js";


/**
 * Handles messages being sent by the UI.
 *
 * @param {Event} event - The message sent by the UI thread.
 */
onmessage = async function (event){
	switch (event.data.message) {
		// Start the simulation by sending the `globalThis.settings` object from the UI controls.
		case "start": {
			sendLogEvent("Starting simulation");
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
			sendLogEvent("Pausing simulation");
			globalThis.settings.run = false;
			break;
		}
		// Then when the realtime playback is running out of events, a `resume` commands can be send to start receiving new events again.
		case "resume": {
			sendLogEvent("Resuming simulation");
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
	#maxDequeueTime = 1500;

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
		this.#dequeueStartTime = Date.now();

		// Go through every event in the queue (as long as the simulation isn't paused)
		while(this.#events.length > 0 && globalThis.settings.run){

			if(Date.now() - this.#dequeueStartTime > this.#maxDequeueTime){
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

				try{
					event.run?.call(event.with || {});
				}catch(error){
					sendErrorEvent("An internal function encountered an error", {error});
					throw error;
				}

			}else if (event instanceof NodeEvent){

				// Get the node's data, hand it over to a node process, and then save the modified node data after the data packet has been processed

				sendLogEvent(`Let node ${event.packet.to} process ${event.packet.summary} from ${event.packet.from === event.packet.to ? "a higher power" : `node ${event.packet.from}`}`);

				let nodeData, sendPackets;
				try{
					const result = await globalThis.nodeProcess(
						event.packet,
						globalThis.nodes.get(event.packet.to),
					);
					nodeData = result.nodeData;
					sendPackets = result.sendPackets;
				}catch(error){
					sendErrorEvent(`The node algorithm encountered an error`, {error});
					throw error;
				}

				try{
					// Update the color of the node based on the ends of its current blockchain.
					const colors = nodeData.blockchain.getEnds().map(block => {
						const { chain } = nodeData.blockchain.find(block);
						let trust = 0;
						for(const block of chain.blocks) trust += block.trust;
						trust /= chain.blocks.length;
						return {color: block.id, trust};
					});
					sendDrawEvent({
						type: "nodeColor",
						address: nodeData.address,
						colors,
					});

					globalThis.nodes.update(nodeData);

					this.#handleBlockchainEvents();

					for(const packet of sendPackets){
						this.enqueue(new NodeEvent(packet, globalThis.timestamp));
					}
				}catch(error){
					sendErrorEvent("An error was encountered while handling the result of the node process", {error});
					throw error;
				}

			}

		}

		// Make it known that no instances of `dequeue` are running anymore
		this.#dequeueing = false;
	}

	/**
	 * This function runs every time a node has altered its blockchain. It creates a federated blockchain
	 * that contains all the blocks in all the other nodes, and then compares it to the previous
	 * federated blockchain. If there were any changes, they are sent to the UI thread to be drawn.
	 */
	#handleBlockchainEvents(){
		const events = [];

		const globalChain = new BlockChain({});
		const globalChainTrust = new Map();
		for(const nodeData of globalThis.nodes.values()){
			for(const block of nodeData.blockchain){
				const id = `${block.id}${block.previousId}`;
				if(!globalChainTrust.has(id)) globalChainTrust.set(id, {block, trusts: []});
				globalChainTrust.get(id).trusts.push(block.trust);
				globalChain.add(block);
			}
		}

		for(const { block, trusts } of globalChainTrust.values()){
			const trust = average(...trusts);
			for(const { chain, localIndex } of globalChain.findAll(block)){
				chain.blocks[localIndex].trust = trust;
			}
		}

		/**
		 * Check if the beginning of the blockchain contains blocks that are completely trusted.
		 * If yes, then remove them from the entire simulation. They are not interesting anymore
		 * and just eat up memory and processing resources.
		 */
		let trustedIndex = 0;
		while(globalChain.blocks[trustedIndex]?.trust === 1){
			trustedIndex++;
		}
		if(trustedIndex > 0){
			const blocksToTrim = globalChain.blocks.slice(0, trustedIndex + 1);
			sendLogEvent(`Trim fully trusted block${blocksToTrim.slice(0, -1).length > 1 ? "s" : ""} ${new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(blocksToTrim.slice(0, -1).map(block => block.id))}`);
			for(const nodeData of globalThis.nodes.values()){
				nodeData.blockchain.trimBase(blocksToTrim);
			}
		}


		const allBlocks = new Map();
		const blockSizes = [];
		defineBlockPosition(globalChain, allBlocks, blockSizes);

		/**
		 * Tries to create a unique string for each specific block, which is used to detect the
		 * difference between the same block being moved somewhere else, and a block being removed,
		 * while a new block is added somewhere else.
		 *
		 * This is still experimental and doesn't really work the way it should. When it works, it
		 * should allow the UI to animate blocks moving around in the federated blockchain.
		 *
		 * @param {BlockChain} chain - The chain to define block positions on.
		 * @param {Map<string, Block>} allBlocks - The map where unique block positions are saved, and points to the block.
		 * @param {number[]} blockSizes - The size of each block within the UI. They get smaller as more branches are added.
		 * @param {object} scope - Some information passed to the function when it is a recursive call.
		 */
		function defineBlockPosition(chain, allBlocks, blockSizes, scope = {top: 0, height: 100, left: 0}){

			blockSizes.push(scope.height);

			for(const block of chain.blocks){
				block.top = scope.top + (scope.height / 2);
				block.left = scope.left;
				scope.left++;

				allBlocks.set(`${block.id}${block.previousId}${block.localId}`, block);
			}

			const newHeight = scope.height / chain.branches.length;
			let newTop = scope.top;
			for(const branch of chain.branches){
				defineBlockPosition(
					branch,
					allBlocks,
					blockSizes,
					{
						top: newTop,
						height: newHeight,
						left: scope.left,
					},
				);
				newTop += newHeight;
			}
		}

		const blockSize = clampMin(2, 20, ...blockSizes);
		for(const [ key, block ] of allBlocks.entries()){
			block.left *= blockSize;
			block.left += blockSize;
			allBlocks.set(key, block);
		}

		for(const key of [...new Set([...allBlocks.keys(), ...this.#lastAllBlocks.keys()])]){
			const oldBlock = this.#lastAllBlocks.get(key);
			const newBlock = allBlocks.get(key);

			if(!newBlock){
				events.push({
					action: "remove",
					localId: oldBlock.localId,
				});
			}else if(!oldBlock){
				events.push({
					action: "add",
					id: newBlock.id,
					localId: newBlock.localId,
					trust: newBlock.trust,
					top: newBlock.top,
					left: newBlock.left,
				});
			}else{
				let needsUpdate = false;
				const updates = {};
				for(const key of [ "trust", "top", "left" ]){
					if(newBlock[key] !== oldBlock[key]){
						updates[key] = newBlock[key];
						needsUpdate = true;
					}
				}

				if(needsUpdate){
					events.push({
						action: "update",
						localId: newBlock.localId,
						...updates,
					});
				}
			}
		}

		if(events.length > 0){
			sendDrawEvent({
				type: "chainUpdate",
				blockSize,
				events,
			});
		}

		this.#lastAllBlocks = allBlocks;
	}
	#lastAllBlocks = new Map();
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
		while (globalThis.nodes.size < Math.min(globalThis.settings.nodes.startNodes, globalThis.settings.network.nodes)) {
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
		while (globalThis.nodes.size < Math.min(initialNodesCount + Number(globalThis.settings.nodes.nodesToAdd), globalThis.settings.network.nodes)) {
			const address = globalThis.nodes.create();
			const addressPacket = new AddressPacket(address, address, this.firstNodes);

			globalThis.eventQueue.enqueue(new NodeEvent(addressPacket, this.timestamp));
		}
	}

	// If there are still more nodes to be added, then enqueue a function event for `addNodes` to continue after a small timeout.
	if (globalThis.nodes.size < globalThis.settings.network.nodes) {
		const nextTimestamp = this.timestamp + Number(globalThis.settings.nodes.delay);
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
 * This function is responsible for adding new blocks to the network. It replaces the consensus mechanism
 * that real networks use.
 * The new block is simply given to a completely random node. This is usually also what real consensus
 * mechanisms strive to do, although there are exceptions.
 * When the function runs, it adds itself back to te event queue with a delay, ensuring that the new blocks
 * continue to show up indefinitely.
 */
function newBlock(){
	const nodeAddresses = [...globalThis.nodes.keys()];
	const findingNodeAddress = nodeAddresses[Math.floor(random("consensus", nodeAddresses.length))];

	const newBlockSignal = new NewBlockSignal(findingNodeAddress);

	globalThis.eventQueue.enqueue(new NodeEvent(newBlockSignal, globalThis.timestamp));

	globalThis.eventQueue.enqueue(new FunctionEvent(newBlock, undefined, globalThis.timestamp + Number(globalThis.settings.block.delay)));

}

// Initialize the necessary classes and objects to run the simulation
globalThis.settings = {};
globalThis.eventQueue = new EventQueue();
globalThis.nodes = new Nodes();
