/**
 * @file
 * This is the main script file.
 */


//This is just temporary until we have a working user interface.
globalThis.settings = {
	algorithm: "Bitcoin",
	nodesCount: 20,
};
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

const events =
[
	new Event(
		addNodes,
	),
];

let play = true;
setTimeout(() => {play = false;}, 30000);

const nodes = new Map();

/**
 *
 */
function addNodes(){
	this.firstNodes ??= [];

	if(this.firstNodes.length === 0){
		while(nodes.size < Math.min(5, globalThis.settings.nodesCount)){
			const id = Symbol();
			this.firstNodes.push(id);
			nodes.set(id, new algorithm.Node());
		}
		for(const nodeAddress of this.firstNodes){
			const node = nodes.get(nodeAddress);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive = nodeAddresses;
		}
	}else{
		const initialNodesCount = nodes.length;
		while(nodes.size < Math.min(initialNodesCount + 5, globalThis.settings.nodesCount)){
			const node = new algorithm.Node();
			nodes.set(Symbol(), node);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.receive = nodeAddresses;
		}
	}

	if(nodes.size < globalThis.settings.nodesCount){
		events.push(new Event(
			addNodes,
			{firstNodes: [...this.firstNodes]},
			Date.now() + 2000,
		));
	}
}

/**
 *
 */
function runEvents(){
	for(const event of events){
		if(event.timestamp <= Date.now()){
			event.run?.call(event.with || {});
		}
	}
	if(play){
		setTimeout(runEvents, 1000);
	}else{
		for(const node of nodes.values()){
			console.log(node);
			console.log(nodes.size);
		}
	}
}

const algorithm = await import(`./algorithms/${globalThis.settings.algorithm}.js`);
runEvents();
