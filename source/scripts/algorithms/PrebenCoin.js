/**
 * @file
 * This is the PrebenCoin file.
 */

//export const description = " ";

/**
 *
 * @param {object} event
 */
onmessage = event => {
	const storage = event.data.storage;

	//Does nothing. No connections are made :P

	postMessage(storage);
};
