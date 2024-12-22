import CookieService from '../networking/CookieService.js';

export class RoomAPI {
	static async createRoom() {
		try {
			const response = await fetch("/pong/room/create/", {
				method: "POST",
				headers: {
					"X-CSRFToken": CookieService.getCookie("csrftoken"),
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				credentials: 'include',
				body: JSON.stringify({
					mode: 'AI'
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (data.status !== 'success') {
				throw new Error(data.message || 'Failed to create room');
			}

			return data;
		} catch (error) {
			console.error('Error creating room:', error);
			throw error;
		}
	}

	static async fetchRoomHtml(roomId) {
		try {
			const response = await fetch(`/pong/room/${roomId}/`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					"Accept": "text/html"
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.text();
		} catch (error) {
			console.error('Error fetching room HTML:', error);
			throw error;
		}
	}
} 