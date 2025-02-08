import { GameRules } from '../pong/core/GameRules.js';

export const RoomStates = {
	LOBBY: 'LOBBY',
	PLAYING: 'PLAYING'
};

export const roomActions = {
	CREATE_ROOM: 'CREATE_ROOM',
	JOIN_ROOM: 'JOIN_ROOM',
	LEAVE_ROOM: 'LEAVE_ROOM',
	UPDATE_ROOM: 'UPDATE_ROOM',
	UPDATE_ROOM_SETTINGS: 'UPDATE_ROOM_SETTINGS',
	UPDATE_PLAYERS: 'UPDATE_PLAYERS',
	UPDATE_ROOM_STATE: 'UPDATE_ROOM_STATE',
	UPDATE_ROOM_MODE: 'UPDATE_ROOM_MODE',
	TOGGLE_WEBGL: 'TOGGLE_WEBGL',
	CLEAR_ROOM: 'CLEAR_ROOM',
	SET_ERROR: 'SET_ERROR',
	CLEAR_ERROR: 'CLEAR_ERROR'
};

export const RoomModes = {
	AI: 'AI',
	CLASSIC: 'CLASSIC',
	RANKED: 'RANKED',
	TOURNAMENT: 'TOURNAMENT'
};

export const SettingsSchema = {
	ballSpeed: {
		type: 'number',
		min: 1,
		max: 10,
		default: GameRules.DEFAULT_SETTINGS.ballSpeed,
		required: true
	},
	paddleSpeed: {
		type: 'number',
		min: 1,
		max: 10,
		default: GameRules.DEFAULT_SETTINGS.paddleSpeed,
		required: true
	},
	paddleSize: {
		type: 'number',
		min: 1,
		max: 10,
		default: GameRules.DEFAULT_SETTINGS.paddleSize,
		required: true
	},
	maxScore: {
		type: 'number',
		min: 1,
		max: 100,
		default: GameRules.DEFAULT_SETTINGS.maxScore,
		required: true
	},
	aiDifficulty: {
		type: 'string',
		enum: ['Easy', 'Medium', 'Hard'],
		default: GameRules.DEFAULT_SETTINGS.aiDifficulty,
		required: false,
		condition: (settings) => settings.mode === RoomModes.AI
	}
};

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

export const getDefaultSettingsForMode = (mode) => {
	const settings = {};

	// Get defaults from schema
	Object.entries(SettingsSchema).forEach(([key, schema]) => {
		// Skip if the field has a condition that isn't met
		if (schema.condition && !schema.condition({ mode })) {
			return;
		}

		// Use schema default if available
		if (schema.default !== undefined) {
			settings[key] = schema.default;
		}
	});

	// Override mode-specific settings

	return settings;
};

export const initialRoomState = {
	id: '',
	error: null,
	isPrivate: false,
	isHost: false,
	useWebGL: false,
	mode: RoomModes.AI,
	state: RoomStates.LOBBY,
	currentGameId: 0,
	maxPlayers: getMaxPlayersForMode(RoomModes.AI),
	players: [],
	settings: getDefaultSettingsForMode(RoomModes.AI),
	createdAt: 0,
	createdBy: 0,
	pendingInvitations: [],
	lastUpdate: null
};

/**
 * Validates settings against the schema
 * @param {Object} settings - Settings to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export const validateSettings = (settings) => {
	const errors = [];

	Object.entries(SettingsSchema).forEach(([key, schema]) => {
		// Skip validation if the field has a condition that isn't met
		if (schema.condition && !schema.condition(settings)) {
			return;
		}

		const value = settings[key];

		// Check required fields
		if (schema.required && value === undefined) {
			errors.push(`Missing required field: ${key}`);
			return;
		}

		// Skip validation for optional fields that are not present
		if (!schema.required && value === undefined) {
			return;
		}

		// Validate type
		switch (schema.type) {
			case 'string':
				if (typeof value !== 'string') {
					errors.push(`${key} must be a string`);
				}
				if (schema.enum && !schema.enum.includes(value)) {
					errors.push(`${key} must be one of: ${schema.enum.join(', ')}`);
				}
				break;
			case 'number':
				if (typeof value !== 'number') {
					errors.push(`${key} must be a number`);
				}
				if (schema.min !== undefined && value < schema.min) {
					errors.push(`${key} must be at least ${schema.min}`);
				}
				if (schema.max !== undefined && value > schema.max) {
					errors.push(`${key} must be at most ${schema.max}`);
				}
				break;
			case 'boolean':
				if (typeof value !== 'boolean') {
					errors.push(`${key} must be a boolean`);
				}
				break;
		}
	});

	return {
		isValid: errors.length === 0,
		errors
	};
};

export const roomValidators = {
	id: (value) => typeof value === 'string',
	isPrivate: (value) => typeof value === 'boolean',
	isHost: (value) => typeof value === 'boolean',
	currentGameId: (value) => typeof value === 'number',
	useWebGL: (value) => typeof value === 'boolean',
	mode: (value) => Object.values(RoomModes).includes(value),
	state: (value) => Object.values(RoomStates).includes(value),
	players: (value) => Array.isArray(value),
	settings: (value) => {
		return (
			typeof value === 'object' &&
			validateSettings(value).isValid
		);
	},
	createdAt: (value) => typeof value === 'number',
	createdBy: (value) => typeof value === 'number',
	pendingInvitations: (value) => Array.isArray(value),
	error: (value) => value === null || typeof value === 'object',
	lastUpdate: (value) => value === null || typeof value === 'number'
};

export const roomReducers = {
	[roomActions.CREATE_ROOM]: (state, payload) => {
		const { id, isPrivate, createdBy } = payload;
		const now = Date.now();

		return {
			...state,
			id,
			isPrivate: isPrivate || false,
			createdBy: createdBy.id,
			players: [createdBy],
			lastUpdate: now,
			createdAt: now
		};
	},

	[roomActions.JOIN_ROOM]: (state, payload) => {
		const { userId, username } = payload;
		const newPlayer = { id: userId, username };

		return {
			...state,
			players: [...state.players.filter(p => p.id !== userId), newPlayer],
			pend: state.pend.filter(inv => inv.roomId !== state.id),
			lastUpdate: Date.now()
		};
	},

	[roomActions.LEAVE_ROOM]: (state, payload) => {
		const { userId } = payload;
		const updatedPlayers = state.players.filter(p => p.id !== userId);

		if (updatedPlayers.length === 0) {
			return initialRoomState;
		}

		return {
			...state,
			players: updatedPlayers,
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_SETTINGS]: (state, payload) => {
		const { settings } = payload;
		const newSettings = { ...state.settings, ...settings };
		const validation = validateSettings(newSettings);

		if (!validation.isValid) {
			return {
				...state,
				error: new Error("Failed to validate settings")
			};
		}

		return {
			...state,
			settings: newSettings,
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_PLAYERS]: (state, payload) => {
		const { players } = payload;

		return {
			...state,
			players,
			lastUpdate: Date.now()
		};
	},

	// State is the room status not entire room state in this context
	[roomActions.UPDATE_ROOM_STATE]: (state, payload) => {
		const { state: roomState } = payload;

		return {
			...state,
			state: roomState,
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_MODE]: (state, payload) => {
		const { mode } = payload;

		return {
			...state,
			mode,
			maxPlayers: getMaxPlayersForMode(mode),
			settings: {
				...state.settings,
				...getDefaultSettingsForMode(mode)
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM]: (state, payload) => {
		const { settings, ...roomData } = payload;

		return {
			...state,
			...roomData,
			maxPlayers: getMaxPlayersForMode(roomData.mode || state.mode),
			settings: settings ? {
				...getDefaultSettingsForMode(roomData.mode || state.mode),
				...state.settings,
				...settings,
			} : state.settings,
			lastUpdate: Date.now()
		};
	},

	[roomActions.TOGGLE_WEBGL]: (state, payload) => {
		return {
			...state,
			useWebGL: payload.useWebGL
		}
	},

	[roomActions.CLEAR_ROOM]: () => initialRoomState,

	[roomActions.SET_ERROR]: (state, payload) => {
		const { code, message } = payload;
		return {
			...state,
			error: {
				code,
				message,
				timestamp: Date.now()
			}
		};
	},

	[roomActions.CLEAR_ERROR]: (state) => {
		return {
			...state,
			error: null
		};
	}
};
