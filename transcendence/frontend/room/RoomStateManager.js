import Store from '../state/store.js';
import { RoomModes, getMaxPlayersForMode, getDefaultSettingsForMode, roomActions, RoomStatus } from '../state/roomState.js';
import logger from '../logger.js';

export class RoomStateManager {
	constructor(roomId) {
		this._store = Store.getInstance();
		this._roomId = roomId;
		this._state = {
			mode: RoomModes.AI,
			status: RoomStatus.ACTIVE,
			owner: { id: null, username: null },
			players: [],
			pendingInvitations: [],
			maxPlayers: getMaxPlayersForMode(RoomModes.AI),
			settings: getDefaultSettingsForMode(RoomModes.AI)
		};
		this._initializeStoreSubscription();
	}

	// Getters
	get roomId() { return this._roomId; }
	get mode() { return this._state.settings.mode; }
	get owner() { return this._state.owner; }
	get players() { return Array.isArray(this._state.players) ? this._state.players : []; }
	get pendingInvitations() { return Array.isArray(this._state.pendingInvitations) ? this._state.pendingInvitations : []; }
	get maxPlayers() { return this._state.maxPlayers; }
	get state() { return this._state.status; }
	get settings() { return this._state.settings; }

	get availableSlots() {
		const playerCount = this._state.players.length;
		const invitationCount = this._state.pendingInvitations.length;
		return this._state.maxPlayers - playerCount - invitationCount;
	}

	updateState(newState) {
		const processedState = this._processAndValidateState(newState);
		const hasChanged = this._applyStateChanges(processedState);

		if (hasChanged) {
			this._notifyStateChange();
		}
	}

	updateSettings(settings) {
		const validatedSettings = {
			...this._state.settings,
			...settings
		};

		this._state.settings = validatedSettings;
		this._notifyStateChange();

		return validatedSettings;
	}

	_mapStatus(status) {
		// Map server status to client status
		const statusMap = {
			'active': RoomStatus.ACTIVE,
			'LOBBY': RoomStatus.ACTIVE,
			'game_in_progress': RoomStatus.GAME_IN_PROGRESS,
			'PLAYING': RoomStatus.GAME_IN_PROGRESS,
			'finished': RoomStatus.FINISHED,
			'FINISHED': RoomStatus.FINISHED,
			'closed': RoomStatus.CLOSED,
			'CLOSED': RoomStatus.CLOSED
		};
		return statusMap[status] || status;
	}

	_processAndValidateState(roomState) {
		const mode = roomState.mode || (roomState.settings?.mode) || this._state.mode;
		const status = this._mapStatus(roomState.status || this._state.status);

		logger.debug('Processing room state:', {
			incoming: roomState,
			mappedStatus: status,
			currentState: this._state
		});

		return {
			mode,
			settings: {
				...getDefaultSettingsForMode(mode),
				...(roomState.settings || {}),
				mode
			},
			owner: roomState.owner || this._state.owner,
			players: Array.isArray(roomState.players) ? roomState.players : this._state.players,
			pendingInvitations: Array.isArray(roomState.pendingInvitations) ? roomState.pendingInvitations : this._state.pendingInvitations,
			maxPlayers: roomState.maxPlayers || getMaxPlayersForMode(mode),
			status
		};
	}

	_applyStateChanges(newState) {
		const oldStateStr = JSON.stringify(this._state);
		this._state = {
			...this._state,
			...newState
		};
		return oldStateStr !== JSON.stringify(this._state);
	}

	_notifyStateChange() {
		// Update store
		this._store.dispatch({
			domain: 'room',
			type: roomActions.UPDATE_ROOM,
			payload: {
				id: this._roomId,
				...this._state
			}
		});
	}

	canStartGame() {
		const playerCount = this._state.players.length;
		if (this._state.mode === RoomModes.TOURNAMENT) {
			return playerCount >= 3 && playerCount <= this._state.maxPlayers;
		} else if (this._state.mode === RoomModes.AI) {
			return playerCount === 1;
		}
		return playerCount === this._state.maxPlayers;
	}

	_initializeStoreSubscription() {
		// Subscribe to room state changes
		this._unsubscribeRoom = this._store.subscribe('room', (roomState) => {
			const activeRoomId = roomState.activeRoom;
			const activeRoom = roomState.rooms[activeRoomId];
			if (activeRoomId === this._roomId && activeRoom) {
				this.updateState(activeRoom);
			}
		});
	}

	destroy() {
		if (this._unsubscribeRoom) {
			this._unsubscribeRoom();
		}
	}
} 