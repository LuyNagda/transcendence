/**
 * Deep equality comparison helper for state objects
 * @param {any} obj1 First object to compare
 * @param {any} obj2 Second object to compare
 * @returns {boolean} True if objects are deeply equal
 */
export function isDeepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;
	if (!obj1 || !obj2) return false;
	if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;

	for (const key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!isDeepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
} 