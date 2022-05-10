/**
 * @file
 * This file contains some low-level utilities that are used in the project.
 */

/**
 * Takes a list of numbers, finds the smallest of them,
 * then clamps that value between a minimum and maximum value.
 *
 * @param {number} minimum - The smallest allowed number.
 * @param {number} maximum - The largest allowed number.
 * @param {...number} numbers - A list of numbers of which the smallest is chosen.
 *
 * @returns {number} - The smallest value, clamped.
 */
export function clampMin(minimum, maximum, ...numbers){
	return Math.max(Math.min(...numbers, maximum), minimum);
}

/**
 * Takes a list of numbers and calculates the average of them.
 *
 * @param  {...number} numbers - The list of numbers to find the average of.
 *
 * @returns {number} - The average of the list of numbers.
 */
export function average(...numbers){
	return numbers.reduce((accumulated, next) => accumulated + next, 0) / numbers.length;
}

/**
 * Generates a custom length hash based on the contents of a text string.
 *
 * Uses the SHA-1 algorithm, which is not cryptographically safe.
 *
 * @param {string} string - The string to hash.
 * @param {number} length - The length of the generated hash.
 *
 * @returns {string} - The hash.
 */
export async function hash(string, length){
	const encoder = new TextEncoder();

	const buffer = encoder.encode(string).buffer;
	const hash = (await crypto.subtle.digest("sha-1", buffer)).slice(0, length);
	const textHash = Array.from(new Uint8Array(hash)).map(number => number.toString(36).at(-1)).join("");

	return textHash;
}
