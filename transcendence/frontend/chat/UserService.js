import logger from '../utils/logger.js';

export default class UserService {
	constructor(chatApp) {
		this.chatApp = chatApp;
		this.currentUserId = this.getCurrentUserId();
		this.selectedUserId = null;
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

	async refreshUserList() {
		try {
			const response = await fetch('/chat/users/', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch users');
			}

			const users = await response.json();
			this.updateUserListDOM(users);
		} catch (error) {
			logger.error('Error refreshing user list:', error);
		}
	}

	updateUserListDOM(users) {
		const userList = document.querySelector('.user-list ul');
		if (!userList) return;

		userList.innerHTML = users.map(user => `
			<li>
				<button href="#" 
					class="btn btn-transparent btn-sm me-1 user-chat ${user.id === this.selectedUserId ? 'active' : ''}" 
					data-user-id="${user.id}">
					<img src="${user.profile_picture}" class="rounded-circle" style="max-width: 20px;" 
						alt="${user.name || user.username}'s profile picture">
					<span class="user-name">${user.name || user.username}</span>
					<span class="status-icon">
						${user.online ? '&#x1F7E2;' : '&#x26AA;'}
					</span>
				</button>
			</li>
		`).join('');

		// Reattach event listeners using the chatApp instance
		document.querySelectorAll('.user-chat').forEach(element => {
			element.addEventListener('click', (e) => {
				const userId = parseInt(element.dataset.userId);
				this.selectedUserId = userId;
				this.chatApp.handleUserClick(e);
			});
		});
	}
}