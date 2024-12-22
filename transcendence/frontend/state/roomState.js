// Room State Actions
export const roomActions = {
	CREATE_ROOM: 'CREATE_ROOM',
	JOIN_ROOM: 'JOIN_ROOM',
	LEAVE_ROOM: 'LEAVE_ROOM',
	UPDATE_ROOM_SETTINGS: 'UPDATE_ROOM_SETTINGS',
	UPDATE_MEMBERS: 'UPDATE_MEMBERS',
	UPDATE_ROOM_STATUS: 'UPDATE_ROOM_STATUS'
};

// Initial room state
export const initialRoomState = {
	rooms: {},  // Keyed by roomId
	activeRoom: null,
	invitations: [],  // Array of pending room invitations
	lastUpdate: null
};

// Room structure
const roomStructure = {
	id: '',
	name: '',
	type: 'public',  // 'public' | 'private' | 'game'
	status: 'active',  // 'active' | 'closed' | 'game_in_progress'
	members: [],
	settings: {
		maxMembers: 10,
		allowSpectators: true,
		isPrivate: false
	},
	createdAt: null,
	createdBy: null
};

// Room state validators
export const roomValidators = {
	rooms: (value) => {
		return typeof value === 'object' &&
			Object.values(value).every(room => {
				return typeof room === 'object' &&
					typeof room.id === 'string' &&
					typeof room.name === 'string' &&
					['public', 'private', 'game'].includes(room.type) &&
					['active', 'closed', 'game_in_progress'].includes(room.status) &&
					Array.isArray(room.members) &&
					typeof room.settings === 'object' &&
					typeof room.settings.maxMembers === 'number' &&
					typeof room.settings.allowSpectators === 'boolean' &&
					typeof room.settings.isPrivate === 'boolean' &&
					typeof room.createdAt === 'number' &&
					typeof room.createdBy === 'string';
			});
	},
	activeRoom: (value) => value === null || typeof value === 'string',
	invitations: (value) => {
		return Array.isArray(value) &&
			value.every(invitation => {
				return typeof invitation === 'object' &&
					typeof invitation.roomId === 'string' &&
					typeof invitation.invitedBy === 'string' &&
					typeof invitation.timestamp === 'number';
			});
	}
};

// Room state reducers
export const roomReducers = {
	[roomActions.CREATE_ROOM]: (state, payload) => {
		const { id, name, type, createdBy, settings } = payload;
		const newRoom = {
			...roomStructure,
			id,
			name,
			type,
			members: [createdBy],
			settings: { ...roomStructure.settings, ...settings },
			createdAt: Date.now(),
			createdBy
		};

		return {
			...state,
			rooms: {
				...state.rooms,
				[id]: newRoom
			},
			activeRoom: id,
			lastUpdate: Date.now()
		};
	},

	[roomActions.JOIN_ROOM]: (state, payload) => {
		const { roomId, userId } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members: [...new Set([...room.members, userId])]
				}
			},
			activeRoom: roomId,
			invitations: state.invitations.filter(inv => inv.roomId !== roomId),
			lastUpdate: Date.now()
		};
	},

	[roomActions.LEAVE_ROOM]: (state, payload) => {
		const { roomId, userId } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		const updatedMembers = room.members.filter(id => id !== userId);
		const shouldCloseRoom = updatedMembers.length === 0;

		if (shouldCloseRoom) {
			const { [roomId]: _, ...remainingRooms } = state.rooms;
			return {
				...state,
				rooms: remainingRooms,
				activeRoom: state.activeRoom === roomId ? null : state.activeRoom,
				lastUpdate: Date.now()
			};
		}

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members: updatedMembers
				}
			},
			activeRoom: state.activeRoom === roomId ? null : state.activeRoom,
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_SETTINGS]: (state, payload) => {
		const { roomId, settings } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					settings: {
						...room.settings,
						...settings
					}
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_MEMBERS]: (state, payload) => {
		const { roomId, members } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					members
				}
			},
			lastUpdate: Date.now()
		};
	},

	[roomActions.UPDATE_ROOM_STATUS]: (state, payload) => {
		const { roomId, status } = payload;
		const room = state.rooms[roomId];

		if (!room) return state;

		return {
			...state,
			rooms: {
				...state.rooms,
				[roomId]: {
					...room,
					status
				}
			},
			lastUpdate: Date.now()
		};
	}
};
