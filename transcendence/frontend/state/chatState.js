// Chat State Actions
export const chatActions = {
	INITIALIZE: 'INITIALIZE',
	UPDATE_CHAT: 'UPDATE_CHAT',
	SET_SELECTED_USER: 'SET_SELECTED_USER',
	ADD_MESSAGE: 'ADD_MESSAGE',
	ADD_MESSAGES: 'ADD_MESSAGES',
	CLEAR_HISTORY: 'CLEAR_HISTORY',
	UPDATE_USERS: 'UPDATE_USERS',
	INCREMENT_UNREAD: 'INCREMENT_UNREAD',
	CLEAR_UNREAD: 'CLEAR_UNREAD'
};

// Initial chat state
export const initialChatState = {
	messages: {},
	users: [],
	selectedUser: null,
	unreadCounts: {},
	lastUpdate: Date.now()
};

// Validators
const validateMessage = message => (
	message &&
	typeof message.id === 'number' &&
	typeof message.sender === 'number' &&
	typeof message.content === 'string' &&
	typeof message.timestamp === 'number' &&
	(!message.type || ['text', 'system', 'game_invite'].includes(message.type))
);

const validateUser = user => (
	user &&
	typeof user.id === 'number' &&
	typeof user.username === 'string' &&
	typeof user.online === 'boolean' &&
	typeof user.blocked === 'boolean'
);

// Exported validators for store
export const chatValidators = {
	messages: value => (
		typeof value === 'object' &&
		Object.values(value).every(messages =>
			Array.isArray(messages) &&
			messages.every(validateMessage)
		)
	),
	users: value => (
		Array.isArray(value) &&
		value.every(validateUser)
	),
	selectedUser: value => (
		value === null || validateUser(value)
	),
	unreadCounts: value => (
		typeof value === 'object' &&
		Object.values(value).every(count =>
			typeof count === 'number' && count >= 0
		)
	),
	lastUpdate: value => (
		typeof value === 'number' &&
		!isNaN(value)
	)
};

// Chat state reducers
export const chatReducers = {
	[chatActions.INITIALIZE]: (state, payload) => ({
		...initialChatState,
		...payload,
		lastUpdate: Date.now()
	}),

	[chatActions.UPDATE_CHAT]: (state, payload) => ({
		...state,
		...payload,
		lastUpdate: Date.now()
	}),

	[chatActions.SET_SELECTED_USER]: (state, payload) => ({
		...state,
		selectedUser: payload ? validateUser(payload) ? payload : state.selectedUser : null,
		lastUpdate: Date.now()
	}),

	[chatActions.ADD_MESSAGE]: (state, { friendId, message }) => {
		if (!validateMessage(message)) return state;

		const roomMessages = state.messages[friendId] || [];
		return {
			...state,
			messages: {
				...state.messages,
				[friendId]: [...roomMessages, message]
			},
			lastUpdate: Date.now()
		};
	},

	[chatActions.ADD_MESSAGES]: (state, { friendId, messages }) => ({
		...state,
		messages: {
			...state.messages,
			[friendId]: [...(state.messages[friendId] || []), ...messages]
		},
		lastUpdate: Date.now()
	}),

	[chatActions.CLEAR_HISTORY]: (state, { friendId }) => ({
		...state,
		messages: {
			...state.messages,
			[friendId]: []
		},
		lastUpdate: Date.now()
	}),

	[chatActions.UPDATE_USERS]: (state, users) => ({
		...state,
		users: Array.isArray(users) && users.every(validateUser) ? users : state.users,
		lastUpdate: Date.now()
	}),

	[chatActions.INCREMENT_UNREAD]: (state, { friendId }) => ({
		...state,
		unreadCounts: {
			...state.unreadCounts,
			[friendId]: (state.unreadCounts[friendId] || 0) + 1
		},
		lastUpdate: Date.now()
	}),

	[chatActions.CLEAR_UNREAD]: (state, { friendId }) => ({
		...state,
		unreadCounts: {
			...state.unreadCounts,
			[friendId]: 0
		},
		lastUpdate: Date.now()
	})
};
