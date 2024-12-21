import logger from '../utils/logger.js';
import { ConnectionManager } from '../networking/ConnectionManager.js';

export class ChatNetworkManager {
	constructor() {
		this._connectionManager = new ConnectionManager();
		this._messageHandlers = new Map();
		this._isConnected = false;
	}

	async connect() {
		try {
			// Create connection for chat
			const connection = this._connectionManager.createConnection(
				'websocket',
				'chat',
				{
					endpoint: '/ws/chat/',
					options: {
						maxReconnectAttempts: 5
					}
				}
			);

			// Set up handlers
			connection.on('message', (data) => this._handleMessage(data));
			connection.on('close', () => this._handleClose());
			connection.on('error', (error) => this._handleError(error));

			// Connect
			await connection.connect();
			this._isConnected = true;
			return true;
		} catch (error) {
			logger.error('Failed to establish chat connection:', error);
			return false;
		}
	}

	sendMessage(message) {
		const connection = this._connectionManager.getConnection('chat');
		if (connection && connection.state.canSend) {
			connection.send(message);
		}
	}

	on(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	off(type) {
		this._messageHandlers.delete(type);
	}

	isConnected() {
		const connection = this._connectionManager.getConnection('chat');
		return connection && connection.state.name === 'connected';
	}

	destroy() {
		this._isConnected = false;
		this._messageHandlers.clear();
		this._connectionManager.disconnectAll();
	}

	_handleMessage(data) {
		try {
			logger.debug("Received chat data:", data);
			const handler = this._messageHandlers.get(data.type);
			if (handler) {
				handler(data);
			} else {
				logger.warn('No handler found for message type:', data.type);
			}
		} catch (error) {
			logger.error('Error handling chat message:', error);
		}
	}

	_handleClose() {
		logger.warn('Chat WebSocket closed');
		this._isConnected = false;
	}

	_handleError(error) {
		logger.error('Chat WebSocket error:', error);
		this._handleClose();
	}
} 