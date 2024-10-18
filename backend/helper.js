/**
 * Generates a random delay between `min` and `max` milliseconds to simulate human-like interactions.
 * This can help avoid detection as bots by introducing randomness into script actions.
 *
 * @param {number} [min=1000] - Minimum delay in milliseconds (default 1000ms).
 * @param {number} [max=2000] - Maximum delay in milliseconds (default 2000ms).
 * @returns {Promise} - A promise that resolves after the delay.
 */
function randomDelay(min = 1000, max = 2000) {
	return new Promise((r) => setTimeout(r, Math.random() * (max - min) + min));
}

module.exports = {
	randomDelay,
};
