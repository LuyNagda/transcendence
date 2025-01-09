import logger from '../logger.js';
import { BaseNetworkManager } from '../networking/NetworkingCore.js';

/**
 * Manages local game state for single-player modes (AI or local games).
 * Simplified version of NetworkManager without WebRTC/WebSocket connections.
 */
export class LocalNetworkManager extends BaseNetworkManager {
	constructor(gameId, currentUser, isHost) {
		super();
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._isConnected = true;
		this._messageHandlers = new Map();
		this._gameFinished = false;
	}

	/**
	 * No actual connection needed for local games
	 */
	async connect() {
		logger.info('Local game connection initialized');
		return true;
	}

	/**
	 * Always resolves immediately for local games
	 */
	async waitForGuestConnection() {
		if (!this._isHost) {
			throw new Error('Only host can wait for guest connection');
		}
		return true;
	}

	/**
	 * Always resolves immediately for local games
	 */
	async waitForHostConnection() {
		if (this._isHost) {
			throw new Error('Only guest can wait for host connection');
		}
		return true;
	}

	/**
	 * Local message handling (no network involved)
	 */
	sendGameMessage(message) {
		try {
			// If this is a request (has message_id), immediately send back a success response
			if (message.message_id) {
				this._handleMessage({
					type: message.action + '_response',
					message_id: message.message_id,
					status: 'success',
					data: message
				});
				return true;
			}

			const handler = this._messageHandlers.get(message.type);
			if (handler) {
				// Process message locally
				handler(message);
			}
			return true;
		} catch (error) {
			logger.error('Error handling local game message:', error);
			return false;
		}
	}

	/**
	 * Sends game state update (local only)
	 */
	sendGameState(state) {
		return this.sendGameMessage({
			type: 'gameState',
			state: state
		});
	}

	/**
	 * Registers message handler
	 */
	onGameMessage(type, handler) {
		this._messageHandlers.set(type, handler);
	}

	/**
	 * Always returns true for local games
	 */
	isConnected() {
		return this._isConnected;
	}

	/**
	 * Gets the main connection for this manager
	 * @protected
	 */
	_getMainConnection() {
		// For local games, we act as our own connection
		return {
			state: { name: 'connected', canSend: true },
			send: (data) => this.sendGameMessage(data)
		};
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		this._gameFinished = true;
		this._isConnected = false;
		this._messageHandlers.clear();
		logger.info('Local game manager destroyed');
	}
}
