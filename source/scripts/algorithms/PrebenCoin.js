/**
 * @file
 * This is a temporary algorithm used for testing.
 */

/**
 * Takes a special input object with the node's local storage, along with a new
 * data packet that it should process.
 * Then posts a return message with a special object with the local storage again
 * (with possible changes made based on the data packet), and a list of new data
 * packets to send to other nodes.
 *
 * @param {object} event - The message event sent from the simulation.
 * @param packet
 * @param nodeData
 */
export async function process(packet, nodeData){
	return { nodeData, sendPackets: [] };
}
