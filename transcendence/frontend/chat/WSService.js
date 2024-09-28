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
		this.initialize();
	}

	initialize() {
		this.connect();
	}

	connect() {
		this.socket = new WebSocket(this.url);

		this.socket.onopen = () => {
			console.debug('WebSocket connected');
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
			console.warn(`WebSocket closed: ${e.code}, Reason: ${e.reason}`);
			this.isConnected = false;
			this.onCloseCallbacks.forEach(callback => callback(e));
			this.handleReconnection();
		};

		this.socket.onerror = (err) => {
			console.error('WebSocket error:', err);
			this.onErrorCallbacks.forEach(callback => callback(err));
		};
	}

	handleReconnection() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
			console.info(`Reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
			setTimeout(() => {
				this.reconnectAttempts++;
				this.connect();
			}, delay);
		} else {
			console.error('Max reconnect attempts reached.');
			alert('Unable to reconnect. Please refresh the page.');
		}
	}

	send(message) {
		if (this.isConnected) {
			this.socket.send(JSON.stringify(message));
		} else {
			console.warn('WebSocket not connected. Queueing message.');
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
}