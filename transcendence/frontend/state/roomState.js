import { GameRules } from '../pong/core/GameRules.js';

// Room State Actions
export const roomActions = {
	CREATE_ROOM: 'CREATE_ROOM',
	JOIN_ROOM: 'JOIN_ROOM',
	LEAVE_ROOM: 'LEAVE_ROOM',
	UPDATE_ROOM: 'UPDATE_ROOM',
	UPDATE_ROOM_SETTINGS: 'UPDATE_ROOM_SETTINGS',
	UPDATE_MEMBERS: 'UPDATE_MEMBERS',
	UPDATE_ROOM_STATUS: 'UPDATE_ROOM_STATUS',
	UPDATE_ROOM_MODE: 'UPDATE_ROOM_MODE'
};

// Initial room state
export const initialRoomState = {
	rooms: {},  // Keyed by roomId
	activeRoom: null,
	invitations: [],  // Array of pending room invitations
	lastUpdate: null
};

// Define room modes as constants
export const RoomModes = {
	AI: 'AI',
	CLASSIC: 'CLASSIC',
	RANKED: 'RANKED',
	TOURNAMENT: 'TOURNAMENT'
};

// Helper function to get max players for a mode
export const getMaxPlayersForMode = (mode) => {
	switch (mode) {
		case RoomModes.AI:
			return 1;
		case RoomModes.CLASSIC:
		case RoomModes.RANKED:
			return 2;
		case RoomModes.TOURNAMENT:
			return 8;
		default:
			return 2;
	}
};

// Define room statuses
export const RoomStatus = {
	ACTIVE: 'active',
	CLOSED: 'closed',
	GAME_IN_PROGRESS: 'game_in_progress',
	FINISHED: 'finished'
};

// Default settings based on mode
export const getDefaultSettingsForMode = (mode) => {
	const baseSettings = {
		mode: mode,
		maxMembers: getMaxPlayersForMode(mode),
		ballSpeed: GameRules.DEFAULT_SETTINGS.ballSpeed,
		paddleSpeed: GameRules.DEFAULT_SETTINGS.paddleSpeed,
		paddleSize: GameRules.DEFAULT_SETTINGS.paddleSize,
		maxScore: GameRules.DEFAULT_SETTINGS.maxScore,
		allowSpectators: true,
		isPrivate: false
	};

	// Add mode-specific settings
	if (mode === RoomModes.AI) {
		baseSettings.aiDifficulty = GameRules.DEFAULT_SETTINGS.aiDifficulty;
	}

	return baseSettings;
};

// Room structure with mode included
export const roomStructure = {
	id: '',
	name: '',
	mode: RoomModes.AI,
	type: 'game',
	status: RoomStatus.ACTIVE,
	members: [],
	settings: getDefaultSettingsForMode(RoomModes.AI),
	createdAt: null,
	createdBy: null
};

// Room state validators
export const roomValidators = {
	rooms: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(room => {
				return typeof room === 'object' &&
					typeof room.id === 'string' &&
					typeof room.name === 'string' &&
					['public', 'private', 'game'].includes(room.type) &&
					['active', 'closed', 'game_in_progress', 'finished'].includes(room.status) &&
					Array.isArray(room.members) &&
					typeof room.settings === 'object' &&
					typeof room.settings.maxMembers === 'number' &&
					typeof room.settings.allowSpectators === 'boolean' &&
					typeof room.settings.isPrivate === 'boolean' &&
					typeof room.createdAt === 'number' &&
					typeof room.createdBy === 'string';
			});
	},
	activeRoom: (value) => value === null || typeof value === 'string',
	invitations: (value) => {
		return Array.isArray(value) &&
			value.every(invitation => {
				return typeof invitation === 'object' &&
					typeof invitation.roomId === 'string' &&
					typeof invitation.invitedBy === 'string' &&
					typeof invitation.timestamp === 'number';
			});
	}
};

// Room state reducers
export const roomReducers = {
	[roomActions.CREATE_ROOM]: (state, payload) => {
		const { id, name, type, createdBy, settings = {} } = payload;
		const mode = settings.mode || RoomModes.AI;

		const newRoom = {
			...roomStructure,
			id,
			name,
			type,
			mode,  // Set mode from payload or default
			members: [createdBy],
			settings: {
				...getDefaultSettingsForMode(mode),
				...settings,  // Override with any custom settings
				mode  // Ensure mode is set in settings
			},
			createdAt: Date.now(),
			createdBy: String(createdBy)
		};

		return {
			...state,
			rooms: {
				...state.rooms,
				[id]: newRoom
			},
			activeRoom: id,
			lastUpdate: Date.now()
		};
	},

	[roomActions.JOIN_ROOM]: (state, payload) => {
		const { roomId, userId } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members: [...new Set([...room.members, userId])]
				}
			},
			activeRoom: roomId,
			invitations: state.invitations.filter(inv => inv.roomId !== roomId),
			lastUpdate: Date.now()
		};
	},

	[roomActions.LEAVE_ROOM]: (state, payload) => {
		const { roomId, userId } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		const updatedMembers = room.members.filter(id => id !== userId);
		const shouldCloseRoom = updatedMembers.length === 0;

		if (shouldCloseRoom) {
			const { [roomId]: _, ...remainingRooms } = state.rooms;
			return {
				...state,
				rooms: remainingRooms,
				activeRoom: state.activeRoom === roomId ? null : state.activeRoom,
				lastUpdate: Date.now()
			};
		}

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members: updatedMembers
				}
			},
			activeRoom: state.activeRoom === roomId ? null : state.activeRoom,
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_SETTINGS]: (state, payload) => {
		const { roomId, settings } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					settings: {
						...room.settings,
						...settings
					}
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_MEMBERS]: (state, payload) => {
		const { roomId, members } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_STATUS]: (state, payload) => {
		const { roomId, status } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					status
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_MODE]: (state, payload) => {
		const { roomId, mode, settings } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					mode,
					settings: {
						...room.settings,
						...settings,
						mode  // Ensure mode is set in settings
					}
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM]: (state, payload) => {
		const { id, ...roomData } = payload;
		return {
			...state,
			rooms: {
				...state.rooms,
				[id]: {
					...state.rooms[id],
					...roomData,
					settings: {
						...(state.rooms[id]?.settings || {}),
						...(roomData.settings || {}),
						mode: roomData.mode || state.rooms[id]?.mode
					}
				}
			},
			lastUpdate: Date.now()
		};
	}
};
