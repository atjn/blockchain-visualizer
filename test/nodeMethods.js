
import tap from "tap";

import { webcrypto } from "crypto";
import { Block, BlockChain } from "../source/scripts/nodeMethods.js"

globalThis.crypto = webcrypto;

globalThis.settings = {
	seed: 1,
}


tap.test("BlockChain", async () => {

	tap.test("has", async () => {

		const block = new Block();

		const blockchain = new BlockChain({
			blocks: [ block ],
		});

		tap.ok(blockchain.has(block));
		tap.notOk(blockchain.has(new Block()));

	});

	tap.test("add", async () => {

		tap.test("should always add a new unbased block", async() => {

			const blockchain = new BlockChain({});

			for(let i = 0; i < 5; i++){

				const newBlock = new Block();

				blockchain.add(newBlock);

				tap.ok(blockchain.has(newBlock));

			}


		});

		tap.test("should always add a new based block", async() => {

			const blockchain = new BlockChain({});
			let previousBlock = new Block();

			for(let i = 0; i < 5; i++){

				const newBlock = new Block(previousBlock.id);

				blockchain.add(newBlock);

				tap.ok(blockchain.has(newBlock));

				previousBlock = newBlock;

			}


		});

		tap.test("should always add a new based block, despite many branches", async() => {

			const blockchain = new BlockChain({});
			let previousBlocks = [new Block()];

			for(let i = 0; i < 5; i++){

				for(const previousBlock of previousBlocks){

					const newBlock = new Block(previousBlock.id);

					blockchain.add(newBlock);

					tap.ok(blockchain.has(newBlock));

					previousBlocks.push(newBlock);

				}

			}


		});

	});

});
