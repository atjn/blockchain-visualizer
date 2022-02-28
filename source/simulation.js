/**
 * @file
 * This is the simulation file.
 */

//This is just temporary until we have a working user interface.
globalThis.settings = {};

class Event{
	constructor(run, runWith, timestamp){
		this.timestamp = timestamp ?? Date.now();
		this.run = run;
		this.with = runWith;
	}
}

class Packet{
	to;
	from;
}

class NodeAddresses extends Packet{
	addresses = [];
}

const events = [];

const nodes = new Map();

/**
 * Procedurally adds the specified amount of nodes to the visualization.
 */
function addNodes(){
	this.firstNodes ??= [];

	if (this.firstNodes.length === 0) {
		while (nodes.size < Math.min(5, globalThis.settings.network.nodes)) {
			const id = Symbol();
			this.firstNodes.push(id);
			nodes.set(id, new algorithm.Node());
		}
		for(const nodeAddress of this.firstNodes) {
			const node = nodes.get(nodeAddress);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive = nodeAddresses;
		}
	} else {
		const initialNodesCount = nodes.size;
		while (nodes.size < Math.min(initialNodesCount + 5, globalThis.settings.network.nodes)) {
			const node = new algorithm.Node();
			nodes.set(Symbol(), node);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive = nodeAddresses;
		}
	}

	if (nodes.size < globalThis.settings.network.nodes) {
		events.push(
			new Event(
				addNodes,
				{firstNodes: [...this.firstNodes]},
				Date.now() + 2000,
			),
		);
	}
}

/**
 * Runs events
 */
function runEvents(){
	for (const event of events) {
		if (event.timestamp <= Date.now()) {
			event.run?.call(event.with || {});
		}
	}
	setTimeout(runEvents, 1000);
	postMessage(nodes);
}

const algorithm = await import(`./algorithms/${globalThis.settings.network.algorithm}.js`);
runEvents();

onmessage = function(e) {
	switch (e.data.message) {
		case "start": {
			globalThis.settings = e.data.settings;
			events.push(new Event(addNodes));
		}
	}
}
