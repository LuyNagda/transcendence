import Store from '../state/store.js';
import { RoomModes, getMaxPlayersForMode, getDefaultSettingsForMode, roomActions, RoomStates } from '../state/roomState.js';
import logger from '../logger.js';
import { GameRules } from '../pong/core/GameRules.js';

/**
 * Single source of truth for room state management
 */
export class RoomStateManager {
	constructor(store, roomId) {
		this._store = store || Store.getInstance();
		this._roomId = roomId;
		this._subscribers = new Set();
	}


	// Getters that read directly from store
	get roomId() { return this._roomId; }

	get state() {
		const roomState = this._store.getState('room');
		return roomState.state;
	}

	get mode() {
		const roomState = this._store.getState('room');
		return roomState.mode;
	}

	get settings() {
		const roomState = this._store.getState('room');
		return roomState.settings;
	}

	get players() {
		const roomState = this._store.getState('room');
		return roomState.players;
	}

	get pendingInvitations() {
		const room = this._store.getState('room').rooms[this._roomId];
		return room?.pendingInvitations || [];
	}

	get owner() {
		const roomState = this._store.getState('room');
		return roomState.createdBy;
	}

	get maxPlayers() {
		const roomState = this._store.getState('room');
		return roomState.settings.maxPlayers;
	}

	get availableSlots() {
		const roomState = this._store.getState('room');
		return roomState.settings.maxPlayers - roomState.players.length;
	}

	// Helper methods for common state checks
	canStartGame() {
		const roomState = this._store.getState('room');
		return roomState.players.length >= 2 && roomState.state === RoomStates.LOBBY;
	}

	isOwner(userId) {
		const roomState = this._store.getState('room');
		return roomState.createdBy === userId;
	}

	hasPlayer(userId) {
		const roomState = this._store.getState('room');
		return roomState.players.includes(userId);
	}

	hasPendingInvitation(userId) {
		const room = this._store.getState('room');
		return room?.pendingInvitations.length > 0;
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

		const oldState = this._store.getState('room').rooms[this._roomId];
		if (!oldState) return;

		// Dispatch update to store
		this._store.dispatch({
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

		this._store.dispatch({
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

	// Subscription management
	subscribe(callback) {
		this._subscribers.add(callback);
		return () => this._subscribers.delete(callback);
	}

	_notifyStateChange() {
		const state = this._store.getState('room').rooms[this._roomId];
		this._subscribers.forEach(callback => callback(state));
	}

	destroy() {
		this._store.dispatch({
			domain: 'room',
			type: roomActions.LEAVE_ROOM,
			payload: {
				roomId: this._roomId,
				userId: this._store.getState('user').id
			}
		});
		this._subscribers.clear();
	}
}

// Factory function to create RoomStateManager instance
export const createRoomStateManager = (store, roomId) => {
	return new RoomStateManager(store, roomId);
} 