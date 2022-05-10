/**
 * @file
 * Check the description in the UI to see what is unique about this algorithm.
 */

import { AddressPacket, BlockPacket, Block, NewBlockSignal, distance, PeerData } from "../nodeMethods.js";

/**
 * Takes a special input object with the node's local storage, along with a new
 * data packet that it should process.
 * Then posts a return message with a special object with the local storage again
 * (with possible changes made based on the data packet), and a list of new data
 * packets to send to other nodes.
 *
 * @param {Packet} packet - The packet with new data to process.
 * @param {NodeData} nodeData - The node's data.
 */
export async function process(packet, nodeData){

	// Packets to send to other nodes
	const sendPackets = [];

	// A list of any addresses that the node has ever processed in any way.
	// The addresses map to a timestamp of when they were last heard.
	nodeData.heardAddresses ??= new Map();

	if(packet instanceof AddressPacket){

		// Make sure the node is not processing its own address
		packet.addresses = packet.addresses.filter(address => address !== nodeData.address);

		// Update the records to show that it has "heard" about these adresses now
		// If it has never heard of the address before, add it to a list of completely new addresses
		const newAddresses = [];
		for(const address of packet.addresses){
			if(!nodeData.heardAddresses.has(address)) newAddresses.push(address);
			nodeData.heardAddresses.set(address, globalThis.timestamp);
		}

		// Decide which peers the node should talk actively to.
		// Currently decided by finding the 5 nearest nodes along with the node farthest away.
		const activePeerContenders = [];
		for(const [peerAddress, peerData] of nodeData.allAddressEntries){
			activePeerContenders.push({
				address: peerAddress,
				distance: peerData.distance,
			});
		}
		for(const peerAddress of newAddresses){
			activePeerContenders.push({
				address: peerAddress,
				distance: distance(nodeData.position, peerAddress, true),
			});
		}
		activePeerContenders.sort((a, b) => a.distance - b.distance);
		for(const [i, data] of activePeerContenders.entries()){
			if(i < 5 || i === activePeerContenders.length - 1){
				// Add the 5 closest nodes and add the node that is farthest away
				if(!nodeData.hasAddress(data.address)){
					nodeData.setAddress(data.address, new PeerData({
						distance: data.distance,
					}));
				}
			}else{
				// Remove any other node
				if(nodeData.hasAddress(data.address)){
					nodeData.deleteAddress(data.address);
				}
			}
		}

		// Update timestamps for last transmission to each node
		for(const [peerAddress, peerData] of nodeData.allAddressEntries){
			if(!peerData.lastTransmit){
				sendPackets.push(new AddressPacket(peerAddress, nodeData.address, [nodeData.address]));
			}
		}

		// If new addresses were discovered, send those to all active peers.
		if(newAddresses.length > 0){
			for(const address of nodeData.allAddressKeys){
				if(newAddresses.includes(address)) continue;
				sendPackets.push(new AddressPacket(address, nodeData.address, [...newAddresses]));
			}
		}

	}else if(packet instanceof BlockPacket){

		// If the block is not already in the chain, then add it and rebroadcast it to peers.
		if(!nodeData.blockchain.has(packet.block)){

			nodeData.blockchain.add(packet.block);

			for(const address of nodeData.allAddressKeys){
				sendPackets.push(new BlockPacket(address, nodeData.address, packet.block));
			}
		}

	}else if(packet instanceof NewBlockSignal){

		const ends = nodeData.blockchain.getEnds();

		let block;

		// Find the most trusted end and place the block on that.
		// The most trusted block in this case, is the block that is based on the longest chain of other blocks.

		if(ends.length > 0){

			let bestEntry;
			for(const block of ends){

				const entry = nodeData.blockchain.find(block);

				if(entry.globalIndex >= (bestEntry?.globalIndex || 0)){
					bestEntry = entry;
				}

			}

			block = new Block(bestEntry.block.id);
			bestEntry.chain.blocks.push(block);

		}else{
			block = new Block();
			nodeData.blockchain.add(block);
		}

		// Then send information about the new block to all active nodes
		for(const address of nodeData.allAddressKeys){
			sendPackets.push(new BlockPacket(address, nodeData.address, block));
		}

	}

	updateBlockTrustLevels(nodeData);

	removeAbandonedBranches(nodeData);

	// Update last transmission time for all nodes that packets will be sent to
	for(const packet of sendPackets){
		const peerData = nodeData.getAddress(packet.to);
		peerData.lastTransmit = globalThis.timestamp;
		nodeData.setAddress(packet.to, peerData);
	}

	// Update the "last heard" timestamp for the packet sender address
	if(packet.from !== nodeData.id){
		if(nodeData.hasAddress(packet.from)){
			const peerData = nodeData.getAddress(packet.from);
			peerData.lastReceive = globalThis.timestamp;
			nodeData.setAddress(packet.from, peerData);
		}
		nodeData.heardAddresses.set(packet.from, globalThis.timestamp);
	}

	return {nodeData, sendPackets};
}

/**
 * Sets the trust level of each block in the chain.
 * This is done by seeing how many blocks have been built on to of that block.
 * When more than ten other blocks have been built, it is fully trusted.
 *
 * @param {NodeData} nodeData - The node's data.
 */
function updateBlockTrustLevels(nodeData){

	for(const block of nodeData.blockchain) block.trust = 0;

	for(const end of nodeData.blockchain.getEnds()){
		setRecursiveBlockTrust(nodeData.blockchain, end.previousId);
	}

	/**
	 * A recurive method to set the trust levels of all blocks,
	 * going from the end of the chain all the way back to its root.
	 *
	 * @param {BlockChain} baseChain - The root chain that the block is somewhere on (can be a branch).
	 * @param {number} blockId - The ID of the block to find.
	 * @param {number} trust - The trust level that the block should be set to.
	 */
	function setRecursiveBlockTrust(baseChain, blockId, trust = 0){
		if(blockId === undefined) return;
		const trustIncrease = .1;
		trust = Math.min(1, trust + trustIncrease);
		for(const { chain, localIndex, block } of baseChain.findAll({id: blockId})){
			if(!chain || !block) continue;

			chain.blocks[localIndex].trust = Math.max(block.trust, trust);
			setRecursiveBlockTrust(baseChain, block.previousId, trust);
		}
	}

}

/**
 * Cleans up any branches that are clearly not going to continue.
 * If there are more than one branch, any branch that is more than three blocks behind the longest branch is removed.
 * The node can be very confident that this branch won't be necessary to keep, becuase it knows that
 * all the other nodes are going to build new blocks on the longest available branch.
 *
 * @param {NodeData} nodeData - The node's data.
 */
function removeAbandonedBranches(nodeData){

	const ends = nodeData.blockchain.getEnds();

	const endEntries = ends.map(end => nodeData.blockchain.find(end));

	let bestEntry;
	for(const entry of endEntries){
		if(entry.globalIndex >= (bestEntry?.globalIndex || 0)){
			bestEntry = entry;
		}
	}

	for(const entry of endEntries){

		if(entry.globalIndex < bestEntry.globalIndex - 3){
			nodeData.blockchain.removeBranch(entry.chainIndexes);
		}
	}

}
