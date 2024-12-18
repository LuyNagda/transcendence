export class CookieService {
	static getCookie(name) {
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
} 