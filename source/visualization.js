
/**
 * @file
 * This is the main script file.
 */

//This is just temporary until we have a working user interface.
globalThis.settings = {
	algorithm: "Bitcoin",
	nodesCount: 10,
};
class Packet{
	to;
	from;
}
class NodeAddresses extends Packet{
	addresses = [];
}

const events =
[
	{
		timestamp: Date.now(),
		run: addNodes,
	},
];

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
			node.process(nodeAddresses);
		}
	}else{
		const initialNodesCount = this.firstNodes.length;
		while(nodes.size() < Math.min(initialNodesCount + 5, globalThis.settings.nodesCount)){
			const node = new Node();
			nodes.set(Symbol(), node);
			const nodeAddresses = new NodeAddresses;
			nodeAddresses.addresses.push(...this.firstNodes);
			node.process(nodeAddresses);
		}
	}

	if(nodes.size() < globalThis.settings.nodesCount){
		events.push({
			timestamp: Date.now() + 2000,
			run: addNodes,
			with: {firstNodes: [...this.firstNodes]},
		});
	}

}
