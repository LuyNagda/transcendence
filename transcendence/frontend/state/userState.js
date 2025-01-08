import logger from '../logger.js';

// User State Actions
export const userActions = {
	SET_USER: 'SET_USER',
	UPDATE_STATUS: 'UPDATE_STATUS',
	UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
	LOGOUT: 'LOGOUT',
	UPDATE_USER: 'UPDATE_USER'
};

// Initial user state
export const initialUserState = {
	users: {},
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
	lastActive: null,
	blockedUsers: new Set()
};

// User state validators
export const userValidators = {
	id: (value) => value === null || typeof value === 'number',
	username: (value) => value === null || (typeof value === 'string' && value.length >= 3),
	status: (value) => ['online', 'offline', 'playing', 'away'].includes(value),
	preferences: (value) => {
		return typeof value === 'object' &&
			value !== null &&
			['light', 'dark', 'high-contrast'].includes(value.theme) &&
			typeof value.notifications === 'boolean' &&
			['small', 'normal', 'large'].includes(value.fontSize);
	},
	gameStats: (value) => {
		return typeof value === 'object' &&
			value !== null &&
			typeof value.wins === 'number' &&
			typeof value.losses === 'number' &&
			(value.rank === null || typeof value.rank === 'number');
	},
	users: (users) => {
		logger.debug('Validating users:', {
			users,
			type: typeof users
		});

		if (typeof users !== 'object' || users === null) {
			logger.error('Users validation failed: not an object');
			return false;
		}

		return Object.values(users).every(user => {
			logger.debug('Validating user:', {
				user,
				hasId: typeof user.id !== 'undefined',
				idType: typeof user.id,
				hasUsername: typeof user.username === 'string',
				status: user.status,
				blocked: typeof user.blocked === 'boolean'
			});

			const isValid = typeof user === 'object' &&
				user !== null &&
				typeof user.id !== 'undefined' &&
				typeof user.username === 'string' &&
				['online', 'offline'].includes(user.status) &&
				typeof user.blocked === 'boolean';

			if (!isValid) {
				logger.error('User validation failed:', {
					user,
					checks: {
						isObject: typeof user === 'object' && user !== null,
						hasId: typeof user.id !== 'undefined',
						hasUsername: typeof user.username === 'string',
						validStatus: ['online', 'offline'].includes(user.status),
						hasBlocked: typeof user.blocked === 'boolean'
					}
				});
			}

			return isValid;
		});
	},
	lastActive: (value) => value === null || typeof value === 'number',
	blockedUsers: (value) => value instanceof Set || (Array.isArray(value) && value.every(id => typeof id === 'number'))
};

// User state reducers
export const userReducers = {
	[userActions.SET_USER]: (state, payload) => ({
		...state,
		...payload,
		blockedUsers: payload.blockedUsers instanceof Set ? payload.blockedUsers : new Set(payload.blockedUsers || []),
		lastActive: Date.now()
	}),

	[userActions.UPDATE_STATUS]: (state, payload) => {
		logger.debug('UPDATE_STATUS reducer:', {
			currentState: state,
			payload
		});

		const existingUser = state.users[payload.userId] || {
			id: payload.userId,
			username: `User ${payload.userId}`,
			status: 'offline',
			blocked: false
		};

		logger.debug('User to update:', {
			existingUser,
			newStatus: payload.status
		});

		// Keep all existing state properties and only update the users object
		const newState = {
			...state,
			users: {
				...state.users,
				[payload.userId]: {
					...existingUser,
					status: payload.status
				}
			},
			lastActive: Date.now()
		};

		logger.debug('New state:', newState);
		return newState;
	},

	[userActions.UPDATE_USER]: (state, payload) => {
		const existingUser = state.users[payload.id] || {
			id: payload.id,
			username: payload.username,
			status: 'offline',
			blocked: false
		};

		const newState = {
			...state,
			users: {
				...state.users,
				[payload.id]: {
					...existingUser,
					username: payload.username,
					status: payload.status,
					blocked: payload.blocked || false
				}
			},
			lastActive: Date.now()
		};

		// Update blockedUsers Set
		if (payload.blocked) {
			newState.blockedUsers = new Set([...state.blockedUsers, payload.id]);
		} else {
			newState.blockedUsers = new Set([...state.blockedUsers].filter(id => id !== payload.id));
		}

		return newState;
	},

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
	}),
};
