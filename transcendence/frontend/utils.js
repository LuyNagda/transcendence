/**
 * Deep equality comparison helper for state objects excluding timestamp property
 * @param {any} obj1 First object to compare
 * @param {any} obj2 Second object to compare
 * @returns {boolean} True if objects are deeply equal excluding timestamp property
 */
export function isDeepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;
	if (!obj1 || !obj2) return false;
	if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

	const keys1 = Object.keys(obj1).filter(key => key !== 'timestamp');
	const keys2 = Object.keys(obj2).filter(key => key !== 'timestamp');

	if (keys1.length !== keys2.length) return false;

	for (const key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!isDeepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
}

export function getCookie(name) {
	if (!document.cookie || document.cookie === "") {
		return null;
	}

	const cookies = document.cookie.split(";");
	const cookie = cookies.find(c => c.trim().startsWith(name + "="));

	if (!cookie) {
		return null;
	}

	return decodeURIComponent(cookie.substring(name.length + 1).trim());
}