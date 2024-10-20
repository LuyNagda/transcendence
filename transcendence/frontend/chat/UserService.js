import logger from '../utils/logger.js';

export default class UserService {
	constructor() {
		this.currentUserId = this.getCurrentUserId();
	}

	getCurrentUserId() {
		const userId = document.body.dataset.userId;
		if (!userId) {
			logger.error('User ID not found in body dataset.');
			return null;
		}
		return parseInt(userId, 10);
	}

	getUserName(userId) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		return userElement ? userElement.querySelector('.user-name').textContent.trim() : 'Unknown User';
	}

	getUserStatusIcon(userId) {
		const status = this.getUserStatus(userId);
		switch (status) {
			case 'online':
				return '&#x1F7E2;'; // Green circle
			case 'offline':
				return '&#x26AA;'; // White circle
			case 'blocked':
				return '&#x1F534;'; // Red circle
			default:
				return '&#x26AA;'; // Offline
		}
	}

	getUserStatus(userId) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		if (userElement) {
			if (userElement.classList.contains('online')) return 'online';
			if (userElement.classList.contains('blocked')) return 'blocked';
		}
		return 'offline';
	}

	updateUserStatus(userId, status) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		if (userElement) {
			const statusIcon = userElement.querySelector('.status-icon');
			statusIcon.innerHTML = this.getUserStatusIcon(userId);
			userElement.classList.remove('online', 'offline', 'blocked');
			userElement.classList.add(status);

			// Update message bubbles
			const messageBubbles = document.querySelectorAll(`.chat-bubble[data-user-id="${userId}"] .status-icon`);
			messageBubbles.forEach(icon => {
				icon.innerHTML = this.getUserStatusIcon(userId);
				icon.classList.remove('online', 'offline', 'blocked');
				icon.classList.add(status);
			});
		}
	}
}