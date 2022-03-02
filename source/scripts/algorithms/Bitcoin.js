/**
 * @file
 * This is an implementation of the Bitcoin algorithm.
 */

/**.
 * Takes a special input object with the node's local storage, along with a new
 * data packet that it should process.
 * Then posts a return message with a special object with the local storage again
 * (with possible changes made based on the data packet), and a list of new data
 * packets to send to other nodes.
 *
 * @param {object} event - The message event sent from the simulation.
 * @param {object} event.data - The special data package.
 * @param {object} event.data.packet - The packet of data to process.
 * @param {object} event.data.storage - The node's storage.ANGLE_instanced_arrays
 */
onmessage = ({ data: { packet, storage } }) => {

	storage.nodeAddresses.push(...(packet.addresses || []));

	postMessage(storage);
};
