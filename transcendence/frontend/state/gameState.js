// Game State Actions
export const gameActions = {
	UPDATE_SCORE: 'UPDATE_SCORE',
	UPDATE_PLAYERS: 'UPDATE_PLAYERS',
	UPDATE_STATUS: 'UPDATE_STATUS',
	RESET_GAME: 'RESET_GAME'
};

// Initial game state
export const initialGameState = {
	score: {
		player1: 0,
		player2: 0
	},
	players: [],
	status: 'waiting',
	ballPosition: { x: 0, y: 0 },
	paddlePositions: {
		player1: 0,
		player2: 0
	},
	timestamp: null
};

// Game state validators
export const gameValidators = {
	score: (value) => {
		return typeof value === 'object' &&
			typeof value.player1 === 'number' &&
			typeof value.player2 === 'number' &&
			value.player1 >= 0 &&
			value.player2 >= 0;
	},
	players: (value) => Array.isArray(value) && value.length <= 2,
	status: (value) => ['waiting', 'playing', 'finished', 'paused'].includes(value),
	ballPosition: (value) => {
		return typeof value === 'object' &&
			typeof value.x === 'number' &&
			typeof value.y === 'number';
	},
	paddlePositions: (value) => {
		return typeof value === 'object' &&
			typeof value.player1 === 'number' &&
			typeof value.player2 === 'number';
	}
};

// Game state reducers
export const gameReducers = {
	[gameActions.UPDATE_SCORE]: (state, payload) => ({
		...state,
		score: { ...state.score, ...payload },
		timestamp: Date.now()
	}),

	[gameActions.UPDATE_PLAYERS]: (state, payload) => ({
		...state,
		players: payload,
		timestamp: Date.now()
	}),

	[gameActions.UPDATE_STATUS]: (state, payload) => ({
		...state,
		status: payload,
		timestamp: Date.now()
	}),

	[gameActions.RESET_GAME]: (state) => ({
		...initialGameState,
		players: state.players,
		timestamp: Date.now()
	})
};