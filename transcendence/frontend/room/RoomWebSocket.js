import logger from '../utils/logger.js';
import WSService from '../utils/WSService.js';

export class RoomWebSocket {
	constructor(roomId, onMessage, onClose, onOpen, onError) {
		if (!roomId) {
			logger.error('Room ID is required');
			throw new Error('Room ID is required');
		}
		this.roomId = roomId;
		this.pendingModeChange = null;
		logger.info(`Initializing WebSocket for room ${roomId}`);
		this.wsService = new WSService();
		this.initializeConnection(onMessage, onClose, onOpen, onError);
	}

	initializeConnection(onMessage, onClose, onOpen, onError) {
		const endpoint = `/ws/pong_room/${this.roomId}/`;
		logger.debug(`Connecting to endpoint: ${endpoint}`);
		this.wsService.initializeConnection('pongRoom', endpoint);

		this.wsService.on('pongRoom', 'onMessage', (data) => {
			if (data.type === 'room_update' && this.pendingModeChange) {
				// Handle pending mode change after room update
				const { property, value } = this.pendingModeChange;
				this.pendingModeChange = null;
				this.sendMessage('update_property', { property, value });
			}
			onMessage(data);
		});

		this.wsService.on('pongRoom', 'onClose', (event) => {
			const shouldRetry = this.handleConnectionError(event.code);
			if (shouldRetry) {
				logger.info('Attempting to reconnect...');
				this.wsService.handleReconnection('pongRoom', endpoint);
			} else {
				onClose(event);
			}
		});

		this.wsService.on('pongRoom', 'onOpen', () => {
			logger.info(`Successfully connected to room ${this.roomId}`);
			if (onOpen) onOpen();
		});

		this.wsService.on('pongRoom', 'onError', (error) => {
			logger.error(`WebSocket error for room ${this.roomId}:`, error);
			if (onError) onError(error);
		});
	}

	sendMessage(action, data = {}) {
		if (action === 'update_property' && data.property === 'maxPlayers') {
			const mode = data.value === 1 ? 'AI' :
				data.value === 8 ? 'TOURNAMENT' : 'CLASSIC';
			logger.info(`Converting maxPlayers=${data.value} to mode=${mode}`);

			// Store the mode change request until we get a room update
			this.pendingModeChange = { property: 'mode', value: mode };
			return;
		}

		const message = { action, ...data };
		logger.info(`Sending WebSocket message: ${JSON.stringify(message)}`);
		this.wsService.send('pongRoom', message);
	}

	destroy() {
		if (this.wsService) {
			this.wsService.destroy('pongRoom');
		}
	}

	handleConnectionError(code) {
		const errorMessages = {
			4001: "Authentication failed. Please refresh the page and try again.",
			4002: "Error during connection validation. Please check your game status and try again.",
			4003: "You are not authorized to join this game.",
			4004: "Game not found. It may have been deleted.",
			1006: "Connection closed abnormally. Will retry..."
		};

		const message = errorMessages[code] || `Connection failed with code ${code}`;
		logger.error(message);

		return code === 1006;
	}
} 