import logger from '../logger.js';

export const USER_STATUS = {
	OFFLINE: 'offline',
	ONLINE: 'online',
};

export const userActions = {
	SET_USER: 'SET_USER',
	UPDATE: 'UPDATE',
	LOGOUT: 'LOGOUT'
};

const createInitialState = () => ({
	id: null,
	username: null,
	status: USER_STATUS.OFFLINE,
	gameStats: {
		wins: 0,
		losses: 0,
		rank: null
	},
	lastActive: null,
	blockedUsers: new Set(),
	initialized: false
});

export const initialUserState = createInitialState();

export const userValidators = {
	id: (value) => value === null || typeof value === 'number',
	username: (value) => value === null || (typeof value === 'string' && value.length >= 3),
	status: (value) => Object.values(USER_STATUS).includes(value),
	gameStats: (value) => {
		return typeof value === 'object' &&
			value !== null &&
			typeof value.wins === 'number' &&
			typeof value.losses === 'number' &&
			(value.rank === null || typeof value.rank === 'number');
	},
	lastActive: (value) => value === null || typeof value === 'number',
	blockedUsers: (value) => value instanceof Set || (Array.isArray(value) && value.every(id => typeof id === 'number')),
	initialized: (value) => typeof value === 'boolean'
};

export const userReducers = {
	[userActions.SET_USER]: (state, payload) => {
		if (!payload?.username) {
			logger.error('Invalid SET_USER payload:', payload);
			return state;
		}

		const userId = payload.id || state.id;
		if (!userId) {
			logger.error('No user ID available for SET_USER');
			return state;
		}

		// If state is already initialized with the same user, don't update
		if (state.initialized && state.id === userId) {
			return state;
		}

		const newState = {
			...createInitialState(),
			...payload,
			id: userId,
			status: USER_STATUS.ONLINE,
			initialized: true,
			gameStats: {
				...createInitialState().gameStats,
				...(payload.gameStats || {})
			},
			lastActive: Date.now()
		};

		logger.debug('SET_USER reducer result:', newState);
		return newState;
	},

	[userActions.UPDATE]: (state, payload) => {
		logger.debug('UPDATE reducer:', { currentState: state, payload });

		if (!payload) {
			logger.error('Invalid UPDATE payload');
			return state;
		}

		// Only update if there are actual changes
		if (JSON.stringify(state) === JSON.stringify({ ...state, ...payload })) {
			return state;
		}

		// Only update current user's state
		if (payload.id === state.id) {
			return {
				...state,
				...payload,
				blockedUsers: payload.blockedUsers instanceof Set ?
					payload.blockedUsers :
					new Set(payload.blockedUsers || []),
				lastActive: Date.now()
			};
		}

		// If it's not the current user, just update blockedUsers if needed
		if (payload.blocked !== undefined) {
			return {
				...state,
				blockedUsers: payload.blocked ?
					new Set([...state.blockedUsers, payload.id]) :
					new Set([...state.blockedUsers].filter(id => id !== payload.id)),
				lastActive: Date.now()
			};
		}

		return state;
	},

	[userActions.LOGOUT]: () => {
		logger.debug('LOGOUT reducer called');
		return createInitialState();
	}
};
