/**
 * @file
 * This file contains all the classes and functions that the node algorithms can use to do standardized things,
 * such as sending address packets or managing their blockchains.
 */

/**
 * A generic packet of data that can be sent from a node to a node.
 */
export class Packet{
	/**
	 * A generic packet of data that can be sent from a node to a node.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 * @param {number} from - Address of the node that sent the packet.
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

	// Summary is used when logging to the "nerd info" box
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
	 * @param {number} from - Address of the node that sent the packet.
	 * @param {number[]} addresses - The list of other node addresses to deliver.
	 */
	constructor(to, from, addresses){
		super(to, from);
		this.addresses = addresses;
	}

	// Summary is used when logging to the "nerd info" box
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
	 * @param {number} from - Address of the node that sent the packet.
	 * @param {Block} block - The block to deliver to the other node.
	 */
	constructor(to, from, block){
		super(to, from);
		this.block = block;
	}

	// Summary is used when logging to the "nerd info" box
	get summary(){
		return `block ${this.block.id}`;
	}
}

/**
 * A NewBlockSignal tells the node that it has "mined" a new block, and is allowed to add it
 * to the blockchain.
 * In reality, complex systems are used to make sure that blocks are unable to just add blocks
 * whenever they want to, but in this simulation, we expect the algorithm to only add a new
 * block when it received this signal.
 */
export class NewBlockSignal extends Packet{
	/**
	 * A NewBlockSignal tells the node that it has "mined" a new block, and is allowed to add it
	 * to the blockchain.
	 * In reality, complex systems are used to make sure that blocks are unable to just add blocks
	 * whenever they want to, but in this simulation, we expect the algorithm to only add a new
	 * block when it received this signal.
	 *
	 * @param {number} to - Address of the node to send this packet to.
	 */
	constructor(to){
		super(to, to);
	}

	// Summary is used when logging to the "nerd info" box
	get summary(){
		return `a new block`;
	}
}

/**
 * Represents a mined block in the blockchain.
 * It automatically generates a random ID and position when initialized.
 */
export class Block{

	/**
	 * Represents a mined block in the blockchain.
	 * It automatically generates a random ID when initialized.
	 *
	 * @param {bigint} previousId - The previous block in the blockchain to point to.
	 * @param {object[]} ranges - Defines whether the entire block is present, or only part of it. Defaults to the entire block.
	 * @param {Block} copy - Pass an existing block to make this block an exact copy of that one.
	 */
	constructor(previousId, ranges, copy){
		this.#id = randomColor();
		this.#previousId = previousId;
		this.ranges = [...(ranges || [{from: 1, to: this.#size}])];

		if(copy){
			this.#id = copy.id;
			this.trust = copy.trust;
		}
	}

	// The unique ID of this block. It's also a HEX color code that can be used to easily identify the block in the UI.
	#id;
	get id(){
		return this.#id;
	}

	// The ID of the rpevious block in the blockchain.
	#previousId;
	get previousId(){
		return this.#previousId;
	}

	// A decimal score from 0 to 1 on how much this block is trusted by the node
	trust = 1;

	// How many transactions the block can contain.
	#size = 10000;
	get size(){
		return this.#size;
	}

	// Ranges of transactions that are available in this block.
	// Usually the entire block is available.
	ranges = [];

	/**
	 * Set this as the base block in the blockchain. (remove the pointer to a previous block).
	 */
	setAsBase(){
		this.#previousId = undefined;
	}

	/**
	 * Returns an exact copy of this block.
	 *
	 * @returns {Block} - An exact copy of this block.
	 */
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
}

/**
 * A repersentation of each node's permanent storage.
 * This is where the node saves the blockchain it is aware of, along with other node addresses and so forth.
 *
 * This is theoretically just an object where the node can save anything it wants,
 * but it should save certain things in certain places, so that the simulation knows what is going on.
 *
 * The storage also holds a few values that the simulation uses. An example is the x and y coordinates for the node's position.
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

	// The numeric address of this node.
	#address;
	get address(){
		return this.#address;
	}

	// The x- and y-coordinates for this node.
	#position;
	get position(){
		return this.#position;
	}

	/**
	 * A map of all addresses that the node is actively talking to. The node can save information
	 * about the addresses in the map as a `PeerData` class.
	 *
	 * The node will most likely also want to keep a map of all other nodes that it has heard of,
	 * along with the last transmission times to and from that node. That information is not
	 * useful in the simulation, so that is not defined as a standard interface in `NodeData`,
	 * but instead something the node algorithm can implement itself.
	 */
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

	/**
	 * Generates all necessary data about a connection from this node to another node
	 * that is needed in the UI to draw the correct line.
	 *
	 * @param {bigint} toAddress - The adress that the connection is to.
	 *
	 * @returns {object} - A bunch of information about this connection.
	 */
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
 * Saves information about a different node.
 */
export class PeerData{

	/**
	 * Saves information about a different node.
	 *
	 * @param {object} args - Any custom keys to populate in the class.
	 */
	constructor(args){
		for(const [key, value] of Object.entries(args)){
			this[key] = value;
		}
	}

	// The distance to the other node.
	distance;

	// The last time this node transmitted something to the other node.
	lastTransmit;

	// The last time this node received any transmission from the other node.
	lastReceive;
}

/**
 * Outputs a random number between 0 and `max` generated from the global seed.
 * If the same seed is used between runs, the generator will always produce the exact same sequence of "random" values.
 *
 * It also implements contextual reproducability. In other words, if a random number is generated for a node position,
 * a separate seed is used only for that, and not for something else, such as block IDs. This is useful because it means
 * that if the user changes how many nodes are in the simulation, then that does not have influence on the blocks, and
 * they will continue to be identical to the blocks used in the "old" simulation. This allows the user to run tests where
 * they only change one variable, and nothing else changes, not even the "random" events.
 *
 * This specific implementation of a number generator is called mulberry32.
 *
 * @param {string} context - A name for what the random value will be used for.
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
 * Hands out random color codes. These are used as block IDs.
 *
 * @returns {string} - A random HEX color code.
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
 * The addresses are just numbers that count up, and for our purposes this is a fine ID.
 *
 * @returns {bigint} - A new unique node address.
 */
function newAddress(){
	globalThis.rollingAddress ??= 0n;
	globalThis.rollingAddress += 1n;
	return globalThis.rollingAddress;
}

/**
 * Sends a draw event to the main UI thread.
 *
 * Also adds a timestamp and sets `active` to true by default, just because it is tedious
 * to add that manually every time we need to send a draw event.
 *
 * @param {object} data - The draw event.
 */
export function sendDrawEvent(data){
	if ("postMessage" in globalThis) {
		postMessage({
			...{
				timestamp: globalThis.timestamp,
				active: true,
			},
			...data,
		});
	}
}

/**
 * Sends a log event to the "nerd info" box.
 *
 * @param {string} message - The message to log.
 * @param {object} data - Other information about the event.
 */
export function sendLogEvent(message, data){
	postMessage({
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
 * Sends a warning event to the "nerd info" box.
 *
 * @param {string} message - The message to log.
 * @param {object} data - Other information about the event.
 */
export function sendWarningEvent(message, data){
	sendLogEvent(
		message,
		{
			severity: "warning",
			...data,
		},
	);
}

/**
 * Sends an error event to the "nerd info" box.
 *
 * @param {string} message - The message to log.
 * @param {object} data - Other information about the event.
 */
export function sendErrorEvent(message, data){
	sendLogEvent(
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
 * If a node ID is passed to the "position" variables, then the function will find their positions
 * on its own. Otherwise, the position should be delivered in the format `{ x: number, y: number }`.
 *
 * @param {bigint|object} position1 - Position of node 1.
 * @param {bigint|object} position2 - Position of node 2.
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


	// Using Pythagora's sentence a²+b²=c² to calculate the distance.
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
 * @param {object} position1 - Position of node 1.
 * @param {number} position1.x - Horizontal position of node 1.
 * @param {number} position1.y - Vertical position of node 1.
 * @param {object} position2 - Position of node 2.
 * @param {number} position2.x - Horizontal position of node 2.
 * @param {number} position2.y - Vertical position of node 2.
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
 * @param {object} position1 - Position of node 1.
 * @param {number} position1.x - Horizontal position of node 1.
 * @param {number} position1.y - Vertical position of node 1.
 * @param {object} position2 - Position of node 2.
 * @param {number} position2.x - Horizontal position of node 2.
 * @param {number} position2.y - Vertical position of node 2.
 *
 * @returns {number} - The slope of the connection in degrees.
 */
function slope({x: x1, y: y1}, {x: x2, y: y2}){

	// First get the slope as a fraction
	const slopeFraction = (y1 - y2) / (x1 - x2);

	// Now convert from fraction to degrees
	return Math.atan(slopeFraction) * (180 / Math.PI);

}

/**
 * This monster of a class represents a complete chain of blocks, along with any branches it might have.
 * It also contains numerous functions to add, remove, sort, enumerate the blocks in the blockchain.
 *
 * The `BlockChain` class is designed to have a list of blocks, followed by an optional number of branches that
 * all branch from the end of the block list. The branches are themselves full `BlockChain` classes, which
 * allows them to also have a list of branches at their end. This recursive structure allows for an abritrary
 * number of branches at any point in the complete blockchain, which consists of several `BlockChain` classes
 * nested in each other.
 */
export class BlockChain{

	/**
	 * This monster of a class represents a complete chain of blocks, along with any branches it might have.
	 * It also contains numerous functions to add, remove, sort, enumerate the blocks in the blockchain.
	 *
	 * The `BlockChain` class is designed to have a list of blocks, followed by an optional number of branches that
	 * all branch from the end of the block list. The branches are themselves full `BlockChain` classes, which
	 * allows them to also have a list of branches at their end. This recursive structure allows for an abritrary
	 * number of branches at any point in the complete blockchain, which consists of several `BlockChain` classes
	 * nested in each other.
	 *
	 * @param {object} data - Data to initialize the blockchain with.
	 * @param {Block[]} data.blocks - A list of blocks to add to the blockchain.
	 * @param {BlockChain[]} data.branches - A list of branches to add to the blockchain.
	 */
	constructor({ blocks = [], branches = [] }){

		// Note that the constructor creates complete copies of all nested blocks and branches.
		// This means that all information can be altered freely, without worrying that it might be
		// referencing back to a block or chain that is also used somewhere else.
		this.blocks = blocks.map(this.#newBlock);
		this.branches = branches.map(branch => branch.copy());

	}

	// Blocks in the blockchain
	blocks = [];

	// Branches in the blokchcain.
	branches = [];

	/**
	 * Returns a complete copy of this blockchain.
	 *
	 * @returns {BlockChain} - A complete copy of this blockchain.
	 */
	copy(){
		return new BlockChain(this);
	}

	/**
	 * Creates a new block ready to be used in this blockchain.
	 *
	 * A block cannot just be added directly, because it needs to be a new copy, and it needs to have
	 * a new unique local ID, which is only used internally in the `BlockChain` class.
	 *
	 * @param {Block} block - The block to create a new unique version of.
	 * @returns {Block} - The new unique version of the block.
	 */
	#newBlock(block){
		const newBlock = block.copy();
		newBlock.localId = crypto.randomUUID();
		return newBlock;
	}

	/**
	 * Adds a new block to the blockchain.
	 *
	 * @param {Block} block - The new block to add.
	 */
	add(block){
		const newBlock = this.#newBlock(block);

		/**
		 * Just lazily throw the new block into a new base branch,
		 * and let `tidy()` put the block in the correct branch and
		 * position.
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

	/**
	 * Removes a branch from the chain.
	 *
	 * The branch can be nested inside several other branches, which is why you must pass an
	 * array of indexes, one index for each nested branch, which tells the function what the
	 * index is of the branch to move further into.
	 * The last index is the index of the branch to be deleted.
	 *
	 * @param {number[]} indexes - The list of branch indexes to follow to find the nested branch.
	 *
	 * @returns {BlockChain[]} - An array containing the removed branch.
	 */
	removeBranch(indexes){

		let scope = this;
		for(const index of indexes.slice(0, -1)) scope = scope.branches[index];

		return scope.branches.splice(indexes.at(-1), 1);

	}

	/**
	 * Makes sure that all blocks are correctly connected in all possible branch combinations.
	 * Also removes bloat like empty or duplicated branches.
	 *
	 * This function is central to how the visualization works, and is also one of the hardest to properly write.
	 * In its current state, it is terribly unoptimized, and becomes exponentially slower with every branch that
	 * is added to the blockchain.
	 */
	tidy(){

		// Enable this if the simulation is doing some weird shit. Chances are, this function is the culprit.
		const DEBUG = false;

		/**
		 * Most of the methods this function incorporates, can influence whether or not the other methods have
		 * something to fix. Therefore, it is designed as a loop that only stops when none of the methods
		 * could find anything to change. Whenever a method finds anything to fix, it sets the `effect`
		 * boolean to `true`, and then it restarts the loop to see if any other methods might have something
		 * to do now.
		 * The `reruns` number counts how many times the loop was restarted. If it is too many times, we expect
		 * that two different methods are battling each other, changing something back and forth forever, and
		 * thus we throw an error.
		 */
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
			 * If there are any branches without a complete path back to the base block,
			 * which contain blocks that are also present elsewhere, then remove those
			 * blocks from these branches.
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
		 * This function runs recursively on any nested branches as well.
		 *
		 * @param {BlockChain} chain - The chain to perform deep deduplication on.
		 *
		 * @returns {boolean} - True if the function made any changes in the blockchain.
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

	/**
	 * Removes a list of blocks from the base of the chain.
	 *
	 * This is used to remove blocks that are no longer interesting to show in the simulation,
	 * in a real blockchain you would never remove base blocks.
	 *
	 * The last block is not actually removed, but instead set to be the new base block.
	 *
	 * @param {Block[]} blocks - The blocks to remove.
	 */
	trimBase(blocks){

		// Remove all blocks, except the last one
		for(const block of blocks.slice(0, -1)){
			for(const { chain, localIndex } of this.findAll(block)){
				if(!chain) continue;
				chain.blocks.splice(localIndex, 1);
			}
		}

		// Set the last block as the new base block
		for(const { chain, localIndex } of this.findAll(blocks.at(-1))){
			if(!chain) continue;
			chain.blocks[localIndex].setAsBase();
		}

		this.tidy();

	}

	/**
	 * Gets all possible base starts of the blokchcain.
	 *
	 * You might think there can only be one start of a blockchain, but the node might
	 * have received some random blocks that it can't connect to the rest of the
	 * blockchain. In that case, they will constitute alternative starts to the chain.
	 *
	 * @returns {Block[]} - A list of all starts to the blockchain.
	 */
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

	/**
	 * Gets all possible base starts of the blokchcain.
	 *
	 * You might think there can only be one start of a blockchain, but the node might
	 * have received some random blocks that it can't connect to the rest of the
	 * blockchain. In that case, they will constitute alternative starts to the chain.
	 *
	 * @returns {BlockChain[]} - A list of all starts to the blockchain.
	 */
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

	/**
	 * Gets the end block of all branches in the blockchain.
	 *
	 * @returns {Block[]} - A list of all possible ends in the blockchain.
	 */
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
	 * Note that the local identifier is unique to each separate block in the chain, so this
	 * function will not return a block with the same ID and a different local ID.
	 *
	 * @param {string | Block} localId - The previous id pointer of the block to find.
	 *
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
	 * This function does not look for local identifiers, so if you pass a block with a certain (global) ID,
	 * it will find all occurences of that block in the chain.
	 *
	 * The blocks are returned as block entries which includes information about their position in the blockchain.
	 *
	 * @param {object | Block} block - An object containing the necessary identifiers. Compatible with a Block class.
	 * @param {string} block.id - The id of the block to find.
	 * @param {string} block.previousId - The previous id pointer of the block to find.
	 *
	 * @yields {object} - An entry of a block that fits the description.
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
	 * Returns true if the passed block exists in the blockchain.
	 * Optionally, can be told that a certain number of identical blocks need to exist in the blockchain,
	 * before this function returns true.
	 *
	 * This function does not look for local identifiers, so if you pass a block with a certain (global) ID,
	 * it will find all occurences of that block in the chain.
	 *
	 * @param {object | Block} block - An object containing the necessary identifiers. Compatible with a Block class.
	 * @param {number} amount - How many of these blocks must exist before the function returns true.
	 *
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

	/**
	 * This makes it possible to iterate over all blocks in the blockchain.
	 * Blocks in all branches are also included, but no guarantee is given
	 * to which order they are in.
	 *
	 * @yields {Block} - A block in the blockchain.
	 */
	*[Symbol.iterator](){

		// Return blocks in the base chain
		for(const block of this.blocks) yield block;

		// Return blocks in any branch
		for(const branch of this.branches){
			for(const block of branch) yield block;
		}

	}

	/**
	 * A simple text-representation of the entire blockchain. Useful for writing it to logs.
	 *
	 * @returns {string[]} - A list of chains, the first being the base, the rest being branches.
	 */
	get simpleRepresentation(){

		const representation = [
			this.blocks.map(block => `${block.previousId ? "" : ">"}${block.id}`).join(" => "),
		];
		if(this.branches.length > 0){
			representation.push(this.branches.map(branch => branch.simpleRepresentation));
		}

		return representation;
	}
}
