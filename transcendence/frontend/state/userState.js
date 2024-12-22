// User State Actions
export const userActions = {
	SET_USER: 'SET_USER',
	UPDATE_STATUS: 'UPDATE_STATUS',
	UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
	LOGOUT: 'LOGOUT'
};

// Initial user state
export const initialUserState = {
	id: null,
	username: null,
	status: 'offline',
	preferences: {
		theme: 'light',
		notifications: true,
		fontSize: 'normal'
	},
	gameStats: {
		wins: 0,
		losses: 0,
		rank: null
	},
	lastActive: null
};

// User state validators
export const userValidators = {
	id: (value) => typeof value === 'string' && value.length > 0,
	username: (value) => typeof value === 'string' && value.length >= 3,
	status: (value) => ['online', 'offline', 'playing', 'away'].includes(value),
	preferences: (value) => {
		return typeof value === 'object' &&
			['light', 'dark', 'high-contrast'].includes(value.theme) &&
			typeof value.notifications === 'boolean' &&
			['small', 'normal', 'large'].includes(value.fontSize);
	},
	gameStats: (value) => {
		return typeof value === 'object' &&
			typeof value.wins === 'number' &&
			typeof value.losses === 'number' &&
			(value.rank === null || typeof value.rank === 'number');
	}
};

// User state reducers
export const userReducers = {
	[userActions.SET_USER]: (state, payload) => ({
		...state,
		...payload,
		lastActive: Date.now()
	}),

	[userActions.UPDATE_STATUS]: (state, payload) => ({
		...state,
		status: payload,
		lastActive: Date.now()
	}),

	[userActions.UPDATE_PREFERENCES]: (state, payload) => ({
		...state,
		preferences: {
			...state.preferences,
			...payload
		},
		lastActive: Date.now()
	}),

	[userActions.LOGOUT]: () => ({
		...initialUserState,
		lastActive: Date.now()
	})
};
