import Store from '../state/store.js';

export default class MessageService {
	constructor(uiHandler, userService) {
		this.uiHandler = uiHandler;
		this.userService = userService;
		this._store = Store.getInstance();
	}

	validateMessage(message) {
		return typeof message === 'object' &&
			typeof message.id === 'string' &&
			typeof message.sender === 'string' &&
			typeof message.content === 'string' &&
			typeof message.timestamp === 'number' &&
			(!message.type || ['text', 'system', 'game_invite'].includes(message.type));
	}
}