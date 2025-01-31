import { store } from '../state/store.js';
import { RoomModes, getMaxPlayersForMode, getDefaultSettingsForMode, roomActions, RoomStates } from '../state/roomState.js';
import logger from '../logger.js';
import { GameRules } from '../pong/core/GameRules.js';

/**
 * Single source of truth for room state management
 */
export class RoomStateManager {
	constructor(roomId) {
		this._roomId = roomId;
		this._subscribers = new Set();
	}

	get availableSlots() {
		const roomState = store.getState('room');
		if (!roomState || !roomState.settings) {
			return 0;
		}
		return roomState.settings.maxPlayers - roomState.players.length;
	}

	// Helper methods for common state checks
	canStartGame() {
		const roomState = store.getState('room');
		if (!roomState) {
			return false;
		}
		return roomState.players.length >= 2 && roomState.state === RoomStates.LOBBY;
	}

	isOwner(userId) {
		const roomState = store.getState('room');
		if (!roomState) {
			return false;
		}
		return roomState.createdBy === userId;
	}

	hasPlayer(userId) {
		const roomState = store.getState('room');
		if (!roomState) {
			return false;
		}
		return roomState.players.includes(userId);
	}

	hasPendingInvitation(userId) {
		const room = store.getState('room');
		if (!room || !room.pendingInvitations) {
			return false;
		}
		return room.pendingInvitations.length > 0;
	}

	getMode() {
		const roomState = store.getState('room');
		if (!roomState || !roomState.settings) {
			logger.debug('Room state or settings not initialized, using default mode');
			return RoomModes.CLASSIC;
		}
		return roomState.settings.mode || RoomModes.CLASSIC;
	}

	// Player management methods
	addPlayer(player) {
		if (!player || !player.id || !player.username) return;
		if (this.hasPlayer(player.id)) return;

		this.updateState({
			players: [...this.players, player]
		});
	}

	removePlayer(playerId) {
		if (!playerId || !this.hasPlayer(playerId)) return;

		this.updateState({
			players: this.players.filter(p => p.id !== playerId)
		});
	}

	// Invitation management methods
	addInvitation(invitation) {
		if (!invitation || !invitation.id) return;
		if (this.hasPendingInvitation(invitation.id)) return;

		this.updateState({
			pendingInvitations: [...this.pendingInvitations, invitation]
		});
	}

	removeInvitation(invitationId) {
		if (!invitationId) return;

		this.updateState({
			pendingInvitations: this.pendingInvitations.filter(inv => inv.id !== invitationId)
		});
	}

	// Mode management methods
	async changeMode(newMode) {
		if (!Object.values(RoomModes).includes(newMode)) {
			logger.warn('Invalid mode selected:', newMode);
			return false;
		}

		try {
			const defaultSettings = getDefaultSettingsForMode(newMode);
			this.updateSettings({
				...defaultSettings,
				mode: newMode
			});
			return true;
		} catch (error) {
			logger.error('Failed to change mode:', error);
			return false;
		}
	}

	// State transition methods
	transitionToPlaying() {
		if (!this.canStartGame()) {
			logger.warn('Cannot transition to playing state - not enough players');
			return false;
		}

		this.updateState({ state: RoomStates.PLAYING });
		return true;
	}

	transitionToLobby() {
		this.updateState({ state: RoomStates.LOBBY });
		return true;
	}

	// State update methods
	updateState(newState) {
		if (!newState) return;

		const oldState = store.getState('room');
		if (!oldState) return;

		// Dispatch update to store
		store.dispatch({
			domain: 'room',
			type: roomActions.UPDATE_ROOM,
			payload: {
				id: this._roomId,
				...newState
			}
		});

		if (oldState.state !== newState.state)
			this._handleStateTransition(oldState.state, newState.state);

		this._notifyStateChange();
	}

	updateSettings(settings) {
		const { settings: validatedSettings } = GameRules.validateSettings({
			...this.settings,
			...settings
		});

		store.dispatch({
			domain: 'room',
			type: roomActions.UPDATE_ROOM_SETTINGS,
			payload: {
				roomId: this._roomId,
				settings: validatedSettings
			}
		});

		this._notifyStateChange();
	}

	_handleStateTransition(oldState, newState) {
		logger.debug('Room state transition:', { from: oldState, to: newState });

		if (newState === RoomStates.PLAYING) {
			this._ensureGameCanvasReady();
		}
	}

	_ensureGameCanvasReady() {
		const canvas = document.querySelector('#game-container .screen #game');
		if (!canvas) {
			logger.error('Game canvas not found during transition to PLAYING state');
			return;
		}

		if (canvas.width !== GameRules.CANVAS_WIDTH || canvas.height !== GameRules.CANVAS_HEIGHT) {
			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;
		}
	}

	destroy() {
		store.dispatch({
			domain: 'room',
			type: roomActions.LEAVE_ROOM,
			payload: {
				roomId: this._roomId,
				userId: store.getState('user').id
			}
		});
		if (this._subscribers)
			this._subscribers.clear();
	}

	/**
	 * Notifies subscribers of state changes
	 * @private
	 */
	_notifyStateChange() {
		if (this._subscribers) {
			this._subscribers.forEach(callback => {
				try {
					callback(this._state);
				} catch (error) {
					logger.error('Error in state change subscriber:', error);
				}
			});
		}
	}
}

// Factory function to create RoomStateManager instance
export const createRoomStateManager = (roomId) => {
	return new RoomStateManager(roomId);
} 
