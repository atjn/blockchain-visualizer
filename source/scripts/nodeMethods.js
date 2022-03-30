/**
 * @file
 * This file contains all the classes and functions that the node algorithms can use to do standardized things,
 * such as sending address packets or managing their blockchains.
 */

/**
 * A generic packet of data that can be send from a node to a node.
 */
export class Packet{
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
		this.delay = this.distance * globalThis.settings.network.delay;

	}
}

/**
 * An AddressPacket represents a data packet with node addresses in it.
 */
export class AddressPacket extends Packet{
	/**
	 * An AddressPacket represents a data packet with node addresses in it.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the that send the packet.
	 * @param {number[]} addresses - The list of other node addresses to deliver.
	 */
	constructor(to, from, addresses){
		super(to, from);
		this.addresses = addresses;
	}
}

/**
 * A BlockPacket represents a data packet with a block, or parts of a block in it.
 */
export class BlockPacket extends Packet{
	/**
	 * A BlockPacket represents a data packet with a block, or parts of a block in it.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the that send the packet.
	 * @param {Block} block - The block to.
	 */
	constructor(to, from, block){
		super(to, from);
		this.block = block;
	}
}

/**
 * A BlockPacket represents a data packet with a block, or parts of a block in it.
 */
export class NewBlockSignal extends Packet{
	/**
	 * A BlockPacket represents a data packet with a block, or parts of a block in it.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the that send the packet.
	 * @param {Block} block - The block to.
	 */
	constructor(to){
		super(to, to);
	}
}

export class Block{
	constructor(previousId, ranges){
		this.#id = randomColor();
		this.#previousId = previousId;
		this.ranges = ranges || [{from: 1, to: this.#size}];
	}
	#id;
	get id(){
		return this.#id;
	}
	#previousId;
	get previousId(){
		return this.#previousId;
	}
	#size = 10000;
	get size(){
		return this.#size;
	}
	trust = 1;
	ranges = [];
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
export class NodeData{
	constructor(){
		this.#address = newAddress();
		this.#position = {
			x: random("position", globalThis.settings.networkBoxRatio),
			y: random("position"),
		};

		this.#addresses = new Map();
		this.blockchain = new BlockChain({});
	}
	#address;
	get address(){
		return this.#address;
	}
	#position;
	get position(){
		return this.#position;
	}

	#addresses;
	get addressCount(){
		return this.#addresses.size;
	}
	get allAddressEntries(){
		return this.#addresses.entries();
	}
	get allAddressKeys(){
		return this.#addresses.keys();
	}
	getAddress(address){
		return this.#addresses.get(address);
	}
	hasAddress(address){
		return this.#addresses.has(address);
	}
	setAddress(address, newData){
		const oldData = this.#addresses.get(address);

		if(oldData){
			// The connection was already established, we just have new information
		}else{
			// A new connection has been made
			sendDrawEvent({
				type: "connection",
				...this.#generateConnectionEventData(address),
			});
		}

		this.#addresses.set(address, newData);
	}
	deleteAddress(address){

		sendDrawEvent({
			type: "connection",
			active: false,
			...this.#generateConnectionEventData(address),
		});

		this.#addresses.delete(address);
	}

	#generateConnectionEventData(toAddress){
		const fromPosition = this.position;
		const toPosition = globalThis.nodes.get(toAddress).position;

		return {
			id: `${this.address}-${toAddress}`,
			length: distance(fromPosition, toPosition, true),
			slope: slope(fromPosition, toPosition),
			position: middle(fromPosition, toPosition, true),
		};
	}

}

/**
 * Outputs a random number between 0 and `max` generated from the global seed.
 * If the same seed is used between runs, the generator will always produce the exact same sequence of "random" values.
 *
 * This specific implementation of a number generator is called mulberry32.
 *
 * @param context
 * @param {number} max - The maximum number allowed. (the minimum is always 0).
 *
 * @returns {number} - A random number between 0 and `max`.
 */
export function random(context, max = 1){
	if(!context) throw Error("Context is needed");
	globalThis.seeds ??= {};
	const s = globalThis.seeds;
	const c = context;
	s[c] ??= globalThis.settings.seed;
	/* eslint-disable-next-line */
	let t; return max*((s[c]=s[c]+1831565813|0,t=Math.imul(s[c]^s[c]>>>15,1|s[c]),t=t+Math.imul(t^t>>>7,61|t)^t,(t^t>>>14)>>>0)/2**32);
}

/**
 *
 */
export function randomColor(){
	let color = "#";
	for(let i = 0; i < 6; i++){
		/* eslint-disable no-bitwise */
		color += (random("color", 16) | 0).toString(16);
	}
	return color;
}

/**
 * Hands out new node addresses.
 * The addresses are just numbers that count up, for our purposes, it is a fine id.
 *
 * @returns {number} - A new unique node address.
 */
function newAddress(){
	globalThis.rollingAddress ??= 0n;
	globalThis.rollingAddress += 1n;
	return globalThis.rollingAddress;
}

/**
 * @param data
 */
export function sendDrawEvent(data){
	return postMessage({
		...{
			timestamp: globalThis.timestamp,
			active: true,
		},
		...data,
	});
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
 * @param position1
 * @param position2
 * @param {boolean} useBoxRatio - If true, returns a number that is compatible with the UI positions of the nodes. Otherwise it is compatible with the simulation positions.
 *
 * @returns {number} - The distance between the two nodes.
 */
export function distance(position1, position2, useBoxRatio = false){

	if(typeof position1 !== "object"){
		position1 = globalThis.nodes.get(position1).position;
	}
	const {x: x1, y: y1} = position1;

	if(typeof position2 !== "object"){
		position2 = globalThis.nodes.get(position2).position;
	}
	const {x: x2, y: y2} = position2;


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

export class PeerData{
	constructor(args){
		for(const [key, value] of Object.entries(args)){
			this[key] = value;
		}
	}
	distance;
	lastTransmit;
	lastReceive;
}

export class BlockChain{
	constructor({ chain = [], branches = [] }){
		this.chain = chain;
		this.branches = branches;
	}
	chain = [];
	branches = [];

	find(id){

		if(typeof id === "object"){
			id = id.id;
		}

		const index = this.chain.findIndex(block => block.id === id);
		if(index !== -1) return { chain: this, index };

		for(const branch of this.branches){
			const branchResult = branch.find(id);
			if(branchResult.index !== -1) return branchResult;
		}

		return {chain: undefined, index: -1};
	}

	getEnds(){

		const ends = [];

		if(this.branches.length > 0){

			for(const branch of this.branches){
				ends.push(...branch.getEnds());
			}

		}else if(this.chain.length > 0){
			ends.push(this.chain.at(-1));
		}

		return ends;
	}
}
