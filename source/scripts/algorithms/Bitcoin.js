/**
 * @file
 * This is an implementation of the Bitcoin algorithm.
 */

import { AddressPacket, BlockPacket, Block, NewBlockSignal, distance, PeerData } from "../nodeMethods.js";

/**.
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
	const sendPackets = [];
	nodeData.heardAddresses ??= new Map();

	if(packet instanceof AddressPacket){

		// Make sure the node is not processing its own address
		packet.addresses = packet.addresses.filter(address => address !== nodeData.address);

		const newAddresses = [];
		for(const address of packet.addresses){
			if(!nodeData.heardAddresses.has(address)) newAddresses.push(address);
			nodeData.heardAddresses.set(address, globalThis.timestamp);
		}

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
			if(i + 1 < 4){
				if(!nodeData.hasAddress(data.address)){
					nodeData.setAddress(data.address, new PeerData({
						distance: data.distance,
					}));
				}
			}else{
				if(nodeData.hasAddress(data.address)){
					nodeData.deleteAddress(data.address);
				}
			}
		}

		for(const [peerAddress, peerData] of nodeData.allAddressEntries){
			if(!peerData.lastTransmit){
				sendPackets.push(new AddressPacket(peerAddress, nodeData.address, [nodeData.address]));
			}
		}

		if(newAddresses.length > 0){
			for(const address of nodeData.allAddressKeys){
				if(newAddresses.includes(address)) continue;
				sendPackets.push(new AddressPacket(address, nodeData.address, [...newAddresses]));
			}
		}

	}else if(packet instanceof BlockPacket){

		console.log("received");

		if(!nodeData.blockchain.has(packet.block)){

			console.log("yir");

			nodeData.blockchain.add(packet.block);

			for(const address of nodeData.allAddressKeys){
				sendPackets.push(new BlockPacket(address, nodeData.address, packet.block));
			}
		}else{
			console.log("got it");
		}

	}else if(packet instanceof NewBlockSignal){

		const ends = nodeData.blockchain.getEnds();

		let block;

		if(ends.length > 0){

			let bestBlock;
			for(const block of ends){
				if(block.trust >= (bestBlock?.trust || 0)){
					bestBlock = block;
				}
			}
			const { chain } = nodeData.blockchain.find(bestBlock);

			block = new Block(bestBlock.id);
			chain.blocks.push(block);

		}else{
			block = new Block();
			nodeData.blockchain.blocks.push(block);
		}

		for(const address of nodeData.allAddressKeys){
			sendPackets.push(new BlockPacket(address, nodeData.address, block));
		}

	}

	updateBlockTrustLevels(nodeData);

	for(const packet of sendPackets){
		const peerData = nodeData.getAddress(packet.to);
		peerData.lastTransmit = globalThis.timestamp;
		nodeData.setAddress(packet.to, peerData);
	}

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
 * @param nodeData
 */
function updateBlockTrustLevels(nodeData){

	for(const block of nodeData.blockchain) block.trust = 0;

	let trust = 0;
	const trustIncrease = .1;
	for(const end of nodeData.blockchain.getEnds()){
		let block = end;
		while(block.previousId !== undefined){
			trust = Math.min(1, trust + trustIncrease);
			const { chain, localIndex } = nodeData.blockchain.find(block.previousId);

			chain.blocks[localIndex].trust = Math.max(chain.blocks[localIndex].trust, trust);

			block = chain.blocks[localIndex];

		}
	}
}
