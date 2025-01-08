// Chat State Actions
export const chatActions = {
	ADD_MESSAGE: 'ADD_MESSAGE',
	ADD_MESSAGES: 'ADD_MESSAGES',
	SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
	UPDATE_PARTICIPANTS: 'UPDATE_PARTICIPANTS',
	CLEAR_HISTORY: 'CLEAR_HISTORY',
	UPDATE_TYPING_STATUS: 'UPDATE_TYPING_STATUS',
	CLEAR_ALL_UNREAD: 'CLEAR_ALL_UNREAD'
};

// Initial chat state
export const initialChatState = {
	messages: {},
	activeRoom: null,
	participants: {},
	typingStatus: {},
	unreadCounts: {},
	lastMessageTimestamp: null
};

// Message structure validator
const validateMessage = (message) => {
	return typeof message === 'object' &&
		typeof message.id === 'number' &&
		typeof message.sender === 'number' &&
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
	activeRoom: (value) => value === null || typeof value === 'number',
	participants: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(roomParticipants =>
				Array.isArray(roomParticipants) &&
				roomParticipants.every(p => typeof p === 'number')
			);
	},
	typingStatus: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(typingUsers =>
				Array.isArray(typingUsers) &&
				typingUsers.every(u => typeof u === 'number')
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
	[chatActions.CLEAR_ALL_UNREAD]: (state) => {
		return {
			...state,
			unreadCounts: {},
			lastMessageTimestamp: Date.now()
		};
	},

	[chatActions.ADD_MESSAGES]: (state, payload) => {
		const { roomId, messages } = payload;
		const existingMessages = state.messages[roomId] || [];
		const unreadCount = state.activeRoom !== roomId ?
			(state.unreadCounts[roomId] || 0) + messages.length : 0;

		return {
			...state,
			messages: {
				...state.messages,
				[roomId]: [...existingMessages, ...messages]
			},
			unreadCounts: {
				...state.unreadCounts,
				[roomId]: unreadCount
			},
			lastMessageTimestamp: Date.now()
		};
	},

	[chatActions.ADD_MESSAGE]: (state, payload) => {
		const { roomId, message, incrementUnread } = payload;
		const roomMessages = state.messages[roomId] || [];
		const unreadCount = incrementUnread ?
			(state.unreadCounts[roomId] || 0) + 1 :
			(state.unreadCounts[roomId] || 0);

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

	[chatActions.SET_ACTIVE_ROOM]: (state, payload) => {
		// If payload is an object with unreadCounts, use it, otherwise keep existing unreadCounts
		const unreadCounts = typeof payload === 'object' && payload.unreadCounts
			? payload.unreadCounts
			: state.unreadCounts;

		return {
			...state,
			activeRoom: typeof payload === 'object' ? payload.payload : payload,
			unreadCounts,
			lastMessageTimestamp: Date.now()
		};
	},

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
