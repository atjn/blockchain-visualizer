/**
 * @file
 * This is the Bitcoin file.
 */

export const description = " ";

/**
 * @param state
 */
export class Node{
	set receive(packet){
		//todo fix it
		this.nodeAddresses.push(...(packet.addresses || []));
	}
	nodeAddresses = [];
}
