import tap from "tap";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
const site_root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../");
const algorithms_path = path.join(site_root, "source/scripts/algorithms");

import { webcrypto } from "crypto";
globalThis.crypto = webcrypto;

import { AddressPacket, Block, BlockPacket, NewBlockSignal } from "../source/scripts/nodeMethods.js";
import { Nodes } from "../source/scripts/simulationMethods.js";

globalThis.settings = {
	aspectRatio: 1,
	network: {
		delay: 1
	}
}
globalThis.nodes = new Nodes();

for (const file of fs.readdirSync(algorithms_path)) {
	const node = await import("file://" + path.join(algorithms_path, file));

	const to = globalThis.nodes.create();
	const addresses = [globalThis.nodes.create(), globalThis.nodes.create(), globalThis.nodes.create()];

	const packet = new AddressPacket(to, globalThis.nodes.create(), addresses);

	const { nodeData, sendPackets } = await node.process(packet, globalThis.nodes.get(to));

	tap.ok(addresses.every(address => nodeData.hasAddress(address)), "node has all addresses");
	tap.ok(sendPackets.length > 0, "node is sending outbound packets");



	const block = new Block();
	const blockPacket = new BlockPacket(to, globalThis.nodes.create(), block);

	node.process(blockPacket, globalThis.nodes.get(to));

	tap.ok(nodeData.blockchain.has(blockPacket.block), "node has added the block to its blockchain");



	const newBlockSignal = new NewBlockSignal(to, globalThis.nodes.create(), block);

	const { sendPackets: sendNewBlockPackets} = await node.process(newBlockSignal, globalThis.nodes.get(to));

	tap.ok(sendNewBlockPackets.length > 0, "new block is being sent out");
	tap.ok(sendNewBlockPackets.every(block => block instanceof BlockPacket), "outbound packets from new block signal are block packets");
}

// hasAddress has all addresses
// sendPackets is not empty
// nodedata blockchain gets new block
// new blocks are sent yes
// are the blocks sent out the correct block???
