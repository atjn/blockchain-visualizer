/**
 * @file
 * This file contains functions used by the simulation. They are manily separated from the `somulation.js`
 * file because it makes it easier to run unit tests on them.
 */

import { NodeData, sendDrawEvent } from "./nodeMethods.js";

/**
 * This is the store of all the node's permanent data, linked to their addresses.
 *
 * Node data is saved here until a `NodeProcess` with a specific address runs, in which case the data
 * for that address is taken out, and then later delivered back when the `NodeProcess` has altered it.
 */
export class Nodes extends Map{

	/**
	 * Creates a new node, saves it to the store, and returns its address.
	 *
	 * @returns {bigint} - The address of the new node.
	 */
	create(){
		const newNode = new NodeData();
		super.set(newNode.address, newNode);

		sendDrawEvent({
			type: "node",
			address: newNode.address,
			position: newNode.position,
		});

		return newNode.address;
	}

	/**
	 * Save a new/modified data object for a specific node address.
	 *
	 * @param {NodeData} newData - The new data object to save.
	 *
	 * @returns {Nodes} - This.
	 */
	update(newData){
		// Finally, save the new data.
		return super.set(newData.address, newData);
	}

}
