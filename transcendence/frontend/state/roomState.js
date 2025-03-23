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
	TOGGLE_WEBGL: 'TOGGLE_WEBGL',
	CLEAR_ROOM: 'CLEAR_ROOM',
	SET_ERROR: 'SET_ERROR',
	CLEAR_ERROR: 'CLEAR_ERROR'
};

export const RoomModes = {
	AI: 'AI',
	LOCAL: 'LOCAL',
	CLASSIC: 'CLASSIC',
	TOURNAMENT: 'TOURNAMENT'
};

export const initialRoomState = {
	id: '',
	error: null,
	isPrivate: false,
	isHost: false,
	useWebGL: false,
	mode: RoomModes.AI,
	state: RoomStates.LOBBY,
	canStartGame: false,
	maxPlayers: 2,
	players: [],
	settings: {},
	createdAt: '',
	createdBy: 0,
	pendingInvitations: [],
	availableAIs: ['Marvin'],
	lastUpdate: null
};

export const roomValidators = {
	id: (value) => typeof value === 'string',
	isPrivate: (value) => typeof value === 'boolean',
	isHost: (value) => typeof value === 'boolean',
	canStartGame: (value) => typeof value === 'boolean',
	// currentGameId: (value) => typeof value === 'number',
	useWebGL: (value) => typeof value === 'boolean',
	mode: (value) => Object.values(RoomModes).includes(value),
	state: (value) => Object.values(RoomStates).includes(value),
	players: (value) => Array.isArray(value),
	settings: (value) => typeof value === 'object',
	createdAt: (value) => typeof value === 'string',
	createdBy: (value) => typeof value === 'number',
	pendingInvitations: (value) => Array.isArray(value),
	error: (value) => value === null || typeof value === 'object',
	lastUpdate: (value) => value === null || typeof value === 'number',
	availableAIs: (value) => Array.isArray(value)
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
			pendingInvitations: state.pendingInvitations.filter(inv => inv.id !== userId),
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
		return {
			...state,
			settings: {
				...state.settings,
				...settings
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM]: (state, payload) => ({
		...state,
		...payload,
		lastUpdate: Date.now()
	}),

	[roomActions.TOGGLE_WEBGL]: (state, payload) => ({
		...state,
		useWebGL: payload.useWebGL
	}),

	[roomActions.CLEAR_ROOM]: () => initialRoomState,

	[roomActions.SET_ERROR]: (state, payload) => ({
		...state,
		error: {
			code: payload.code,
			message: payload.message,
			timestamp: Date.now()
		}
	}),

	[roomActions.CLEAR_ERROR]: (state) => ({
		...state,
		error: null
	})
};
