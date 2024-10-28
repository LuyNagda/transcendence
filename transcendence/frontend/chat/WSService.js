import logger from '../utils/logger.js';

export default class WSService {
	constructor(url) {
		this.url = url;
		this.socket = null;
		this.messageQueue = [];
		this.isConnected = false;
		this.onMessageCallbacks = [];
		this.onOpenCallbacks = [];
		this.onCloseCallbacks = [];
		this.onErrorCallbacks = [];
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.userIdCheckInterval = null;
		this.initialize();
	}

	initialize() {
		this.setupUserIdWatcher();
	}

	setupUserIdWatcher() {
		const userId = this.getUserId();
		logger.debug('Initial user ID:', userId);
		if (userId && userId !== 'None') {
			this.connect();
		} else {
			logger.debug('No valid user ID found. Waiting for user ID...');
			this.userIdCheckInterval = setInterval(() => {
				const newUserId = this.getUserId();
				logger.debug('Checking for new user ID:', newUserId);
				if (newUserId && newUserId !== 'None') {
					this.connect();
					clearInterval(this.userIdCheckInterval);
				}
			}, 1000);
		}
	}

	connect() {
		this.socket = new WebSocket(this.url);

		this.socket.onopen = () => {
			logger.debug('WebSocket connected');
			this.isConnected = true;
			this.reconnectAttempts = 0;
			this.processQueue();
			this.onOpenCallbacks.forEach(callback => callback());
		};

		this.socket.onmessage = (e) => {
			const data = JSON.parse(e.data);
			this.onMessageCallbacks.forEach(callback => callback(data));
		};

		this.socket.onclose = (e) => {
			logger.warn(`WebSocket closed: ${e.code}, Reason: ${e.reason}`);
			this.isConnected = false;
			this.onCloseCallbacks.forEach(callback => callback(e));
			this.handleReconnection();
		};

		this.socket.onerror = (err) => {
			logger.error('WebSocket error:', err);
			this.onErrorCallbacks.forEach(callback => callback(err));
		};
	}

	handleReconnection() {
		const userId = this.getUserId();
		if (!userId) {
			logger.debug('No user ID available. Skipping reconnection.');
			return;
		}

		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
			logger.info(`Reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
			setTimeout(() => {
				this.reconnectAttempts++;
				this.connect();
			}, delay);
		} else {
			logger.error('Max reconnect attempts reached.');
			alert('Unable to reconnect. Please refresh the page.');
		}
	}

	send(message) {
		if (this.isConnected) {
			const messageWithToken = {
				...message,
				csrfToken: this.getCSRFToken(),
			};
			this.socket.send(JSON.stringify(messageWithToken));
		} else {
			logger.warn('WebSocket not connected. Queueing message.');
			this.messageQueue.push(message);
			if (this.socket.readyState === WebSocket.CLOSED) {
				this.connect();
			}
		}
	}

	processQueue() {
		while (this.messageQueue.length > 0 && this.isConnected) {
			const message = this.messageQueue.shift();
			this.send(message);
		}
	}

	onMessage(callback) {
		this.onMessageCallbacks.push(callback);
	}

	onOpen(callback) {
		this.onOpenCallbacks.push(callback);
	}

	onClose(callback) {
		this.onCloseCallbacks.push(callback);
	}

	onError(callback) {
		this.onErrorCallbacks.push(callback);
	}

	getCSRFToken() {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith('csrftoken='));
		return cookieValue ? cookieValue.split('=')[1] : null;
	}

	getUserId() {
		const body = document.querySelector('body');
		return body ? body.getAttribute('data-user-id') : null;
	}

	destroy() {
		if (this.userIdCheckInterval) {
			clearInterval(this.userIdCheckInterval);
		}
		if (this.socket) {
			this.socket.close();
		}
	}
}