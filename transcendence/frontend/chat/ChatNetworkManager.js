import logger from '../logger.js';
import { BaseNetworkManager } from '../networking/NetworkingCore.js';

export class ChatNetworkManager extends BaseNetworkManager {
	constructor() {
		super();
		this._isConnected = false;
	}

	async connect() {
		try {
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

			connection.on('message', (data) => this._handleMessage(data));
			connection.on('close', () => this._handleClose());
			connection.on('error', (error) => this._handleError(error));

			await connection.connect();
			this._isConnected = true;
			return true;
		} catch (error) {
			logger.error('Failed to establish chat connection:', error);
			return false;
		}
	}

	sendMessage(message) {
		const connection = this._getMainConnection();
		if (connection && connection.state.canSend) {
			connection.send(message);
		}
	}

	_getMainConnection() {
		return this._connectionManager.getConnection('chat');
	}
} 