// Chat State Actions
export const chatActions = {
	ADD_MESSAGE: 'ADD_MESSAGE',
	SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
	UPDATE_PARTICIPANTS: 'UPDATE_PARTICIPANTS',
	CLEAR_HISTORY: 'CLEAR_HISTORY',
	UPDATE_TYPING_STATUS: 'UPDATE_TYPING_STATUS'
};

// Initial chat state
export const initialChatState = {
	messages: {},  // Keyed by roomId
	activeRoom: null,
	participants: {},  // Keyed by roomId
	typingStatus: {},  // Keyed by roomId, contains array of typing users
	unreadCounts: {},  // Keyed by roomId
	lastMessageTimestamp: null
};

// Message structure validator
const validateMessage = (message) => {
	return typeof message === 'object' &&
		typeof message.id === 'string' &&
		typeof message.sender === 'string' &&
		typeof message.content === 'string' &&
		typeof message.timestamp === 'number' &&
		(!message.type || ['text', 'system', 'game_invite'].includes(message.type));
};

// Chat state validators
export const chatValidators = {
	messages: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(roomMessages =>
				Array.isArray(roomMessages) &&
				roomMessages.every(validateMessage)
			);
	},
	activeRoom: (value) => value === null || typeof value === 'string',
	participants: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(roomParticipants =>
				Array.isArray(roomParticipants) &&
				roomParticipants.every(p => typeof p === 'string')
			);
	},
	typingStatus: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(typingUsers =>
				Array.isArray(typingUsers) &&
				typingUsers.every(u => typeof u === 'string')
			);
	},
	unreadCounts: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(count =>
				typeof count === 'number' && count >= 0
			);
	}
};

// Chat state reducers
export const chatReducers = {
	[chatActions.ADD_MESSAGE]: (state, payload) => {
		const { roomId, message } = payload;
		const roomMessages = state.messages[roomId] || [];
		const unreadCount = state.activeRoom !== roomId ?
			(state.unreadCounts[roomId] || 0) + 1 : 0;

		return {
			...state,
			messages: {
				...state.messages,
				[roomId]: [...roomMessages, message]
			},
			unreadCounts: {
				...state.unreadCounts,
				[roomId]: unreadCount
			},
			lastMessageTimestamp: Date.now()
		};
	},

	[chatActions.SET_ACTIVE_ROOM]: (state, payload) => ({
		...state,
		activeRoom: payload,
		unreadCounts: {
			...state.unreadCounts,
			[payload]: 0
		},
		lastMessageTimestamp: Date.now()
	}),

	[chatActions.UPDATE_PARTICIPANTS]: (state, payload) => {
		const { roomId, participants } = payload;
		return {
			...state,
			participants: {
				...state.participants,
				[roomId]: participants
			},
			lastMessageTimestamp: Date.now()
		};
	},

	[chatActions.CLEAR_HISTORY]: (state, payload) => {
		const { roomId } = payload;
		const { [roomId]: _, ...remainingMessages } = state.messages;
		return {
			...state,
			messages: remainingMessages,
			lastMessageTimestamp: Date.now()
		};
	},

	[chatActions.UPDATE_TYPING_STATUS]: (state, payload) => {
		const { roomId, userId, isTyping } = payload;
		const currentTyping = state.typingStatus[roomId] || [];
		const updatedTyping = isTyping
			? [...new Set([...currentTyping, userId])]
			: currentTyping.filter(id => id !== userId);

		return {
			...state,
			typingStatus: {
				...state.typingStatus,
				[roomId]: updatedTyping
			},
			lastMessageTimestamp: Date.now()
		};
	}
};
