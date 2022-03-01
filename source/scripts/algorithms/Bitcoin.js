/**
 * @file
 * This is the Bitcoin file.
 */

export const description = " ";

/**
 * @param state
 * @param event
 */
onmessage = event => {
	const packet = event.data.packet;
	const storage = event.data.storage;

	storage.nodeAddresses.push(...(packet.addresses || []));

	postMessage(storage);
};
