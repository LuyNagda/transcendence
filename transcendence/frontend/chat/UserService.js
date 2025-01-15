import logger from '../logger.js';
import Store from '../state/store.js';

export default class UserService {
	constructor(chatApp) {
		this.chatApp = chatApp;
		this._store = Store.getInstance();
		this.refreshUserList(); // Initial user list load
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

			// Update user statuses in store with complete user data
			users.forEach(user => {
				this._store.dispatch({
					domain: 'user',
					type: 'UPDATE_USER',
					payload: {
						id: user.id,
						status: user.online ? 'online' : 'offline',
						username: user.username,
						blocked: user.blocked
					}
				});
			});

			// Update UI through UIHandler
			this.chatApp.uiHandler.updateUserList(users);
		} catch (error) {
			logger.error('Error refreshing user list:', error);
		}
	}
}