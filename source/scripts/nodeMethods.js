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
	get summary(){
		return `a non-standard packet`;
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
	get summary(){
		return `adress${this.addresses.length > 1 ? "es" : ""} for node${this.addresses.length > 1 ? "s" : ""} ${new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(this.addresses.map(address => String(address)))}`;
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
	get summary(){
		return `block ${this.block.id}`;
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
	get summary(){
		return `a new block`;
	}
}

export class Block{
	constructor(previousId, ranges, copy){
		this.#id = randomColor();
		this.#previousId = previousId;
		this.ranges = [...(ranges || [{from: 1, to: this.#size}])];

		if(copy){
			this.#id = copy.id;
			this.trust = copy.trust;
		}
	}
	copy(){
		return new Block(
			this.previousId,
			this.ranges,
			{
				id: this.id,
				trust: this.trust,
			},
		);
	}
	#id;
	get id(){
		return this.#id;
	}
	#previousId;
	get previousId(){
		return this.#previousId;
	}
	setAsBase(){
		this.#previousId = undefined;
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
			x: random("position", globalThis.settings.aspectRatio),
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
	if ("postMessage" in globalThis) {
		return postMessage({
			...{
				timestamp: globalThis.timestamp,
				active: true,
			},
			...data,
		});
	}
}

/**
 * @param message
 * @param data
 */
export function sendLogEvent(message, data){
	return postMessage({
		...{
			type: "log",
			timestamp: Math.round(globalThis.timestamp / 1000),
			severity: "info",
			message,
		},
		...data,
	});
}

/**
 * @param message
 * @param data
 */
export function sendWarningEvent(message, data){
	return sendLogEvent(
		message,
		{
			severity: "warning",
			...data,
		},
	);
}

/**
 * @param message
 * @param data
 */
export function sendErrorEvent(message, data){
	return sendLogEvent(
		message,
		{
			severity: "error",
			...data,
		},
	);
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
		) / globalThis.settings.aspectRatio);
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
			x: ((x1 + x2) / 2) / globalThis.settings.aspectRatio,
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
	constructor({ blocks = [], branches = [] }){
		this.blocks = blocks.map(this.#newBlock);
		this.branches = branches.map(branch => branch.copy());
	}
	blocks = [];
	branches = [];

	copy(){
		return new BlockChain(this);
	}

	get simpleRepresentation(){

		const representation = [
			this.blocks.map(block => `${block.previousId ? "" : ">"}${block.id}`).join(" => "),
		];
		if(this.branches.length > 0){
			representation.push(this.branches.map(branch => branch.simpleRepresentation));
		}

		return representation;
	}

	#newBlock(block){
		const newBlock = block.copy();
		newBlock.localId = crypto.randomUUID();
		return newBlock;
	}

	add(block){
		const newBlock = this.#newBlock(block);

		/**
		 * Just lazily throw the new block into a new base branch,
		 * and let `tidy()` connect the block and clean up properly.
		 */
		this.branches = [
			new BlockChain({
				blocks: this.blocks,
				branches: this.branches,
			}),
			new BlockChain({
				blocks: [newBlock],
			}),
		];
		this.blocks = [];
		this.tidy();

	}

	removeBranch(indexes){

		let scope = this;
		for(const index of indexes.slice(0, -1)) scope = scope.branches[index];

		return scope.branches.splice(indexes.at(-1), 1);

	}

	/**
	 * Makes sure that all blocks are correctly connected in all possible branch combinations.
	 * Also removes bloat like empty or duplicated branches.
	 */
	tidy(){
		const DEBUG = false;
		let effect;
		let reruns = 0;
		do{
			reruns++;
			effect = false;

			if(reruns > 200){
				throw new Error("Infinite loop detected when tidying a blockchain");
			}

			/**
			 * Remove chains that contain no blocks.
			 */
			for(const { indexes, chain: branch } of this.branchEntries()){
				if(indexes.length > 0 && branch.blocks.length === 0 && branch.branches.length === 0){
					if(DEBUG) console.log("remove chains with no blocks", this.simpleRepresentation, branch.simpleRepresentation);

					this.removeBranch(indexes);

					effect = true;
					break;
				}
			}

			/**
			 * Remove unneccessary branching points that only branch out to one branch.
			 */
			for(const { chain: branch } of this.branchEntries()){
				if(branch.branches.length === 1){
					if(DEBUG) console.log("streamline branches", this.simpleRepresentation, branch.simpleRepresentation);
					branch.blocks.push(...branch.branches[0].blocks);
					branch.branches = branch.branches[0].branches;

					effect = true;
					break;
				}
			}

			/**
			 * Connect blocks that point to each other, but haven't been connected.
			 * This creates new branches that duplicate already existing information,
			 * but it is important to be aware of every possible branch, so that's what we want.
			 */
			newBranches: for(const { chain, localIndex, block } of this.entries()){
				//console.log(chain, localIndex, block);
				const nextBlockBranches = Boolean(localIndex === chain.blocks.length - 1);


				/**
				 * Save the ID's of all branches that already exist.
				 */
				const currentBranches = new Set();
				if(nextBlockBranches){
					for(const branch of chain.branches){
						for(const currentBranch of branch.getStarts()){
							currentBranches.add(`${currentBranch.id}${currentBranch.previousId}`);
						}
					}
				}else{
					//console.log(chain, localIndex, block);
					const currentBranch = chain.blocks[localIndex + 1];
					currentBranches.add(`${currentBranch.id}${currentBranch.previousId}`);
				}

				/**
				 * If a new branch is found that doesn't already exist, then add that branch.
				 */
				for(const possibleBranch of this.findAll({previousId: block.id})){
					const id = `${possibleBranch.block.id}${possibleBranch.block.previousId}`;
					if(!currentBranches.has(id)){
						if(DEBUG) console.log("add new branch", this.simpleRepresentation, chain.simpleRepresentation);
						//console.log(id);
						currentBranches.add(id);
						const newChain = new BlockChain({
							blocks: possibleBranch.chain.blocks.slice(possibleBranch.localIndex),
							branches: possibleBranch.chain.branches,
						});
						if(nextBlockBranches){
							chain.branches.push(newChain);
						}else{
							chain.branches = [
								new BlockChain({
									blocks: chain.blocks.slice(localIndex + 1),
									branches: chain.branches,
								}),
								newChain,
							];
							chain.blocks = chain.blocks.slice(0, localIndex + 1);
						}
						effect = true;
						break newBranches;
					}
				}

			}

			/**
			 * If there are any branches without a complete base path,
			 * which contain blocks that are also present elsewhere,
			 * then remove those blocks from these branches.
			 */
			if(this.blocks.length === 0){
				for(const branch of this.getStartBranches()){
					if(branch.blocks[0].previousId === undefined){
						continue;
					}

					let index = -1;
					let foundElsewhere = true;
					while(index + 1 < branch.blocks.length && foundElsewhere){
						const block = branch.blocks[index + 1];
						if(this.has(block, 2)){
							index++;
						}else{
							foundElsewhere = false;
						}
					}

					if(index > -1){
						if(DEBUG) console.log("remove unbased branches", this.simpleRepresentation, branch.simpleRepresentation);
						branch.blocks.splice(0, index + 1);
						effect = true;
					}
				}
			}

			if(combineBranches(this)) effect = true;

		}while(effect);

		/**
		 * Find identical branches connected to the same root and deduplicate them.
		 *
		 * @param chain
		 */
		function combineBranches(chain){
			let effect = false;
			let didCombineBranches;
			do{
				didCombineBranches = false;
				combineBranchesLoop: for(const [ index, branch ] of chain.branches.entries()){
					for(const [ otherIndex, otherBranch ] of chain.branches.entries()){
						if(index >= otherIndex) continue;
						let blockIndex = 0;
						while(
							branch.blocks.length > blockIndex &&
						otherBranch.blocks.length > 0 &&
						branch.blocks[blockIndex]?.id === otherBranch.blocks[0]?.id
						){
							blockIndex++;
						}
						if(blockIndex > 0){
							//console.log("Combine branches")

							otherBranch.blocks.shift(0, blockIndex);

							const newBranch = new BlockChain(
								branch.blocks.shift(0, blockIndex),
								[ branch, otherBranch ],
							);

							chain.branches.push(newBranch);

							branch.blocks = [];
							branch.branches = [];
							otherBranch.blocks = [];
							otherBranch.branches = [];

							didCombineBranches = true;
							break combineBranchesLoop;
						}
					}
				}
				if(didCombineBranches) effect = true;
			}while(didCombineBranches);

			for(const branch of chain.branches) if(combineBranches(branch)) effect = true;

			return effect;
		}

	}

	trimBase(blocks){

		for(const block of blocks.slice(0, -1)){
			for(const { chain, localIndex } of this.findAll(block)){
				if(!chain) continue;
				chain.blocks.splice(localIndex, 1);
			}
		}

		for(const { chain, localIndex } of this.findAll(blocks.at(-1))){
			if(!chain) continue;
			chain.blocks[localIndex].setAsBase();
		}

		this.tidy();

	}

	getStarts(){

		const starts = [];

		if(this.blocks.length > 0){

			starts.push(this.blocks[0]);

		}else if(this.branches.length > 0){

			for(const branch of this.branches){
				starts.push(...branch.getStarts());
			}

		}

		return starts;
	}

	getStartBranches(){

		const startBranches = [];

		if(this.blocks.length > 0){

			startBranches.push(this);

		}else{

			for(const branch of this.branches){
				startBranches.push(...branch.getStartBranches());
			}

		}

		return startBranches;
	}

	getEnds(){

		const ends = [];

		if(this.branches.length > 0){

			for(const branch of this.branches){
				ends.push(...branch.getEnds());
			}

		}else if(this.blocks.length > 0){
			ends.push(this.blocks.at(-1));
		}

		return ends;
	}

	/**
	 * Finds the block with the given local identifier.
	 *
	 * @param {string | Block} localId - The previous id pointer of the block to find.
	 * @returns {object} - The block that fit the description.
	 */
	find(localId){

		if(typeof localId === "object"){
			localId = localId.localId;
		}

		for(const entry of this.entries()){
			if(localId === entry.block.localId){
				return entry;
			}
		}

		return {};
	}

	/**
	 * Finds all blocks in the blockchain that fits the given identifiers.
	 * All identifiers are optional. If none are defined, this will return all blocks in the blockchain.
	 *
	 * @param {object | Block} param0 - An object containing the necessary identifiers. Compatible with a Block class.
	 * @param {string} param0.id - The id of the block to find.
	 * @param {string} param0.previousId - The previous id pointer of the block to find.
	 * @returns {Array<object>} - A list of entries of blocks that fit the description.
	 */
	*findAll({ id = null, previousId = null }){

		for(const entry of this.entries()){
			if(
				( id === null || entry.block.id === id ) &&
				( previousId === null || entry.block.previousId === previousId )
			){
				yield entry;
			}
		}
	}

	/**
	 * Finds all blocks in the blockchain that fits the given identifiers.
	 * All identifiers are optional. If none are defined, this will return all blocks in the blockchain.
	 *
	 * @param {object | Block} param0 - An object containing the necessary identifiers. Compatible with a Block class.
	 * @param {string} param0.id - The id of the block to find.
	 * @param {string} param0.previousId - The previous id pointer of the block to find.
	 * @param block
	 * @param amount
	 * @returns {boolean} - A list of entries of blocks that fit the description.
	 */
	has(block, amount = 1){

		if([...this.findAll(block)].length >= amount) return true;

		return false;
	}

	*entries(){

		let globalIndex = 0;
		for(const [ localIndex, block ] of this.blocks.entries()){
			yield {
				chainIndexes: [],
				chain: this,
				globalIndex,
				localIndex,
				block,
			};
			globalIndex++;
		}

		for(const [ branchIndex, branch ] of this.branches.entries()){
			for(const blockEntry of branch.entries()){
				blockEntry.chainIndexes.unshift(branchIndex);
				blockEntry.globalIndex += globalIndex;
				if(!blockEntry.block) console.warn("fuck the what");
				yield blockEntry;
			}
		}

	}

	*branchEntries(){

		yield { indexes: [], chain: this };

		for(const [ index, branch ] of this.branches.entries()){
			for(const entry of branch.branchEntries()){
				entry.indexes.unshift(index);
				yield entry;
			}
		}

	}

	*values(){
		for(const block of this) yield block;
	}

	*[Symbol.iterator](){

		for(const block of this.blocks) yield block;

		for(const branch of this.branches){
			for(const block of branch) yield block;
		}

	}
}
