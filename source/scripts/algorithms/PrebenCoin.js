/**
 * @file
 * This is the PrebenCoin file.
 */

export const description = " ";

/**
 * @param state
 * @param event
 */
onmessage = event => {
	const packet = event.data.packet;
	const storage = event.data.storage;

	//Does nothing. No connections are made :P

	postMessage(storage);
};
