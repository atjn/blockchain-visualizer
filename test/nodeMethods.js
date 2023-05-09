
import tap from "tap";

import { Block, BlockChain } from "../source/scripts/nodeMethods.js"

globalThis.settings = {
	seed: 1,
}


tap.test("BlockChain", async () => {

	function generateTestChain(previousBlock, depth = 0){
		previousBlock ??= {id: undefined};
		depth++;

		const blocks = [];
		if(.5 < Math.random()){

			if(previousBlock.id === undefined && .5 < Math.random()){
				previousBlock = new Block();
			}

			const totalBlocks = Math.random() * 6;
			for(let b = 0; b < totalBlocks; b++){
				const newBlock = new Block(previousBlock.id);
				blocks.push(newBlock);
				previousBlock = newBlock;
			}

		}

		const branches = [];
		if(depth < 10 && .6 > Math.random()){

			const totalBranches = Math.random() * 4;
			for(let b = 0; b < totalBranches; b++){
				branches.push(generateTestChain(previousBlock, depth));
			}

		}

		return new BlockChain({
			blocks,
			branches,
		});
	}

	function generateTestChains(number = 20){
		return Array(number).fill(generateTestChain());
	}

	tap.test("has", async () => {

		const block = new Block();

		const blockchain = new BlockChain({
			blocks: [ block ],
		});

		tap.ok(blockchain.has(block), "says it has the block that it has");
		tap.notOk(blockchain.has(new Block()), "does not say that it has a block that it doesn't have");

	});

	tap.test("add", async () => {

		tap.test("should always add a new based block", async() => {

			const blockchain = new BlockChain({});

			for(let i = 0; i < 5; i++){

				const newBlock = new Block();

				blockchain.add(newBlock);

				tap.ok(blockchain.has(newBlock), "has the block that was just added");

			}


		});

		tap.test("should always add a new unbased block", async() => {

			const blockchain = new BlockChain({});
			let previousBlock = new Block();

			for(let i = 0; i < 5; i++){

				const newBlock = new Block(previousBlock.id);

				blockchain.add(newBlock);

				tap.ok(blockchain.has(newBlock), "has the block that was just added");

				previousBlock = newBlock;

			}


		});

	});

});
