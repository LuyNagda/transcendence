export const GameStatus = {
	WAITING: 'waiting',
	PLAYING: 'playing',
	PAUSED: 'paused',
	FINISHED: 'finished',
	ERROR: 'error'
};

export const gameActions = {
	SET_STATUS: 'SET_STATUS',
	SCORE_GOAL: 'SCORE_GOAL',
	SET_SCORES: 'SET_SCORES',
	SET_PLAYERS: 'SET_PLAYERS',
	SET_SETTINGS: 'SET_SETTINGS',
	RESET: 'RESET'
};

export const initialGameState = {
	scores: { left: 0, right: 0 },
	players: [],
	status: GameStatus.WAITING,
	settings: null, // Will be populated from SettingsManager
	winner: null,
	timestamp: Date.now()
};

const checkWinCondition = (scores, settings) => {
	if (!settings || !settings.maxScore) return null;
	const maxScore = settings.maxScore;
	if (scores.left >= maxScore) return 'left';
	if (scores.right >= maxScore) return 'right';
	return null;
};

export const gameReducers = {
	[gameActions.SET_STATUS]: (state, status) => ({
		...state,
		status,
		timestamp: Date.now()
	}),

	[gameActions.SCORE_GOAL]: (state, side) => {
		const scores = {
			...state.scores,
			[side]: state.scores[side] + 1
		};
		const winner = checkWinCondition(scores, state.settings);

		return {
			...state,
			scores,
			status: winner ? GameStatus.FINISHED : state.status,
			winner,
			timestamp: Date.now()
		};
	},

	[gameActions.SET_SCORES]: (state, scores) => {
		const winner = checkWinCondition(scores, state.settings);

		return {
			...state,
			scores,
			status: winner ? GameStatus.FINISHED : state.status,
			winner,
			timestamp: Date.now()
		};
	},

	[gameActions.SET_PLAYERS]: (state, players) => ({
		...state,
		players,
		timestamp: Date.now()
	}),

	[gameActions.SET_SETTINGS]: (state, settings) => ({
		...state,
		settings,
		timestamp: Date.now()
	}),

	[gameActions.RESET]: (state) => ({
		...initialGameState,
		settings: state.settings,
		players: state.players,
		timestamp: Date.now()
	})
};
