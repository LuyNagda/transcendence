import { logger } from './utils/logger.js';

export default class UserService {
	static instance = null;

	constructor() {
		if (UserService.instance)
			return UserService.instance;

		this.user = null;
		this.initializeUserIdListener();

		UserService.instance = this;
	}

	static getInstance() {
		if (!UserService.instance)
			UserService.instance = new UserService();
		return UserService.instance;
	}

	updateUserId(userId) {
		if (userId === 'None' || userId === null) {
			this.user = null;
			document.body.setAttribute('data-user-id', 'None');
			logger.debug('User ID removed');
		} else {
			this.user = userId;
			document.body.setAttribute('data-user-id', userId);
			logger.debug('User ID updated:', userId);
		}
	}

	getUserId() {
		return this.user;
	}

	initializeUserIdListener() {
		logger.debug('Initializing userId listener');
		document.body.addEventListener('updateUserId', (event) => {
			logger.debug('Received updateUserId event:', event);
			this.updateUserId(event.detail.userId);
		});
	}
}