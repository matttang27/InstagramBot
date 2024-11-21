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

/**
 * Copied from MatthewBot2
 * 
 * Compares a real object to a simplified version (ex. for embeds or components), and functions.
 * Returns true if every property in the simplified version is identical in the real object.
 * Otherwise, returns a helpful error string.
 * @param {Object} real
 * @param {Object} mock
 * @param {boolean} [strictArrays=false] - If true, arrays require the same length; otherwise, extra elements are allowed.
 * @returns {string | true} the property that doesn't match / exist
 *
 * Behaviour (tests can be found in {@link file://./matthewClient.test.js}):
 * Empty objects only check that the realObject key is an object.
 *
 * If strictArrays = true,
 * Arrays require the same length.
 * Otherwise, arrays allow extra elements.
 *
 * Properties in the mock object can be predicates (functions).
 * The function is executed with the corresponding property in the real object.
 * If it returns false, the check fails.
 *
 * @example
 * mock = {test: {}}
 * {test: {}} - PASS, {test: {"HELLO":"HI"}} - PASS, {test: {}} - FAIL, {test: "HELLO"} - FAIL
 *
 * @example
 * mock = {test: []}
 * strictArrays = true
 * {test: []} - PASS, {test: ["HELLO"]} - PASS, {test: "HELLO"} - FAIL
 *
 * @example
 * mock = {test: ["HELLO"]}
 * strictArrays = true
 * {test: []} - FAIL, {test: ["HELLO"]} - PASS, {test: ["HELLO","HI"]} - PASS
 *
 * @example
 * mock = {test: n => n > 6}
 * {test: 7} - PASS, {test: "7"} - PASS, {test: []} - FAIL
 *
 * @todo add map / collection functionality? It is already object, but could add strict mode for length.
 */
function matchesSimplifiedProperties(real, mock, strictArrays = false) {
	for (let key in mock) {
		if (real[key] === undefined) {
			return `${key} does not exist in real`;
		}
		if (mock[key] instanceof Function) {
			if (mock[key](real[key]) === false) {
				return `${key} function (${mock[key].toString()}) returned false for ${
					real[key]
				}`;
			}
		} else if (mock[key] instanceof Array) {
			if (!(real[key].constructor == Array)) {
				return `${key} has type ${real[key].constructor.name} instead of Array`;
			}
			if (strictArrays && real[key].length != mock[key].length) {
				return `${key} has size ${real[key].length} instead of ${mock[key].length}. Turn strictArrays off to allow different lengths.`;
			}
			let result = matchesSimplifiedProperties(real[key], mock[key]);

			if (result !== true) {
				let [index, ...message] = result.split(".");
				return `${key}[${index}].${message.join(".")}`;
			}
		} else if (typeof real[key] == "object") {
			let result = matchesSimplifiedProperties(real[key], mock[key]);
			if (result !== true) return `${key}.` + result;
		} else {
			if (real[key] != mock[key])
				return `${key} different: real: ${real[key]}, mock: ${mock[key]}`;
		}
	}
	return true;
}

module.exports = {
	randomDelay, matchesSimplifiedProperties
};
