
/**
 * @file
 * This is the main script file.
 */

//This is just temporary until we have a working user interface.
globalThis.settings = {
	algorithm: "Bitcoin",
	nodesCount: 10,
};
class Event{
	timestamp;
}

class Packet{
	to;
	from;
}
class NodeAddresses extends Packet{
	addresses = [];
}

const events =
[
	new Event({
		timestamp: Date.now(),
		run: addNodes,
	}),
];

let play = true;
setTimeout(() => {play = false;}, 10000);

const nodes = new Map();

/**
 *
 */
function addNodes(){
	this.firstNodes ??= [];

	if(this.firstNodes.length === 0){
		while(nodes.size() < Math.min(5, globalThis.settings.nodesCount)){
			const id = Symbol();
			this.firstNodes.push(id);
			nodes.set(id, new Node());
		}
		for(const node of this.firstNodes){
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive(nodeAddresses);
		}
	}else{
		const initialNodesCount = this.firstNodes.length;
		while(nodes.size() < Math.min(initialNodesCount + 5, globalThis.settings.nodesCount)){
			const node = new Node();
			nodes.set(Symbol(), node);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive(nodeAddresses);
		}
	}

	if(nodes.size() < globalThis.settings.nodesCount){
		events.push(new Event({
			timestamp: Date.now() + 2000,
			run: addNodes,
			with: {firstNodes: [...this.firstNodes]},
		}));
	}
}

/**
 *
 */
function runEvents(){
	for(const event of events){
		if(event.timestamp <= Date.now()){
			event.run.call(event.with || {});
		}
	}
	if(play){
		 setTimeout(runEvents, 1000);
	}else{
		for(const node of nodes.values()){
			console.log(node);
		}
	}
}

runEvents();
