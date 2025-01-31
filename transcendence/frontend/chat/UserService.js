import logger from '../logger.js';
import { store } from '../state/store.js';
import { chatActions } from '../state/chatState.js';

export default class UserService {
	constructor(chatApp) {
		this.chatApp = chatApp;
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

			// Update users in chat state
			store.dispatch({
				domain: 'chat',
				type: chatActions.UPDATE_USERS,
				payload: users.map(user => ({
					id: user.id,
					username: user.username,
					status: user.online ? 'online' : 'offline',
					blocked: user.blocked
				}))
			});

			// Update UI through UIHandler
			this.chatApp.uiHandler.updateUserList(users);
		} catch (error) {
			logger.error('Error refreshing user list:', error);
		}
	}
}