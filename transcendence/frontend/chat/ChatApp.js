import logger from '../logger.js';
import { connectionManager } from '../networking/ConnectionManager.js';
import { store, actions } from '../state/store.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { chatActions } from '../state/chatState.js';
import { USER_STATUS } from '../state/userState.js';
import { getCookie } from '../utils.js';
import { uiActions } from '../state/uiState.js';
import { Modal } from 'bootstrap';

// Attach to window for global access
window.bootstrap = window.bootstrap || {};
window.bootstrap.Modal = Modal;

export default class ChatApp {
	static #instance = null;
    // Store reference to subscription removers
    static #userSubscription = null;

	static async initialize() {
		// Set up initial instance if user is online
        if (store.getState('user').status === USER_STATUS.ONLINE) {
            ChatApp.#instance = new ChatApp();
            await ChatApp.#instance._setupConnection();
        }

        // Create a single user subscription
        ChatApp.#userSubscription = store.subscribe('user', async (state) => {
            if (state.status === USER_STATUS.OFFLINE) {
                if (ChatApp.#instance) {
                    ChatApp.#instance.destroy();
                    ChatApp.#instance = null;
                }
            } else if (state.status === USER_STATUS.ONLINE) {
                if (!ChatApp.#instance) {
                    ChatApp.#instance = new ChatApp();
                    await ChatApp.#instance._setupConnection();
                }
            }
        });
	}

	constructor() {
		this._connection = null;
		this._isChatOpen = false;
		this._lastMessageId = 0;
		this._initializeState();

		logger.info('[ChatApp] ChatApp initialized');
	}

	_initializeState() {
		// Initialize chat state
		store.dispatch({
			domain: 'chat',
			type: chatActions.INITIALIZE
		});

		this.refreshUserList();

		// Register computed properties and methods with JaiPasVu
		this._setupJaiPasVu();

		// Subscribe to chat state changes
		store.subscribe('chat', (state) => {
			// Update the view data without modifying computed properties
			const viewData = {
				...state,
				currentUserId: store.getState('user').id,
				unreadCount: this._computeUnreadCount(state),
				messages: this._computeMessages(state),
				users: this._computeUsers(state),
				selectedUser: state.selectedUser
			};
			jaiPasVu.registerData('chat', viewData);
		});
	}

	_setupJaiPasVu() {
		// Initial state with computed values
		const initialState = store.getState('chat');
		const viewData = {
			...initialState,
			currentUserId: store.getState('user').id,
			unreadCount: this._computeUnreadCount(initialState),
			messages: this._computeMessages(initialState),
			users: this._computeUsers(initialState),
			selectedUser: initialState.selectedUser
		};

		// Register view data
		jaiPasVu.registerData('chat', viewData);

		// Register methods
		jaiPasVu.registerMethods('chat', {
			handleFormSubmit: this.handleFormSubmit.bind(this),
			handleFormSubmitFriendRequest: this.handleFormSubmitFriendRequest.bind(this),
			selectUser: this.selectUser.bind(this),
			blockUser: this.blockUser.bind(this),
			unblockUser: this.unblockUser.bind(this),
			inviteToGame: this.inviteToGame.bind(this),
			viewProfile: this.viewProfile.bind(this),
			removeFriend: this.removeFriend.bind(this),
			formatTimestamp: (timestamp) => new Date(timestamp).toLocaleTimeString(),
			getUserName: (userId) => {
				const user = store.getState('chat').users.find(u => u.id === userId);
				return user ? user.username : 'Unknown User';
			}
		});
	}

	_computeUnreadCount(state) {
		return Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
	}

	_computeMessages(state) {
		const selectedUser = state.selectedUser;
		return selectedUser ? (state.messages[selectedUser.id] || []) : [];
	}

	_computeUsers(state) {
		return state.users.map(user => ({
			...user,
			statusIcon: this._getUserStatusIcon(user)
		}));
	}

	_getUserStatusIcon(user) {
		if (user.blocked) return '🔴'; // Blocked
		return user.online ? '🟢' : '⚪'; // Online/Offline
	}

	async _setupConnection() {
		try {
			this._connection = connectionManager.createConnectionGroup('chat', {
				main: {
					type: 'websocket',
					config: {
						endpoint: '/ws/chat/',
						options: {
							maxReconnectAttempts: 5,
							reconnectInterval: 1000,
							connectionTimeout: 10000
						}
					}
				}
			}).get('main');

			this._setupMessageHandlers();
			await connectionManager.connectGroup('chat');
		} catch (error) {
			logger.error('[ChatApp] Connection setup failed:', error);
			setTimeout(() => this._setupConnection(), 5000);
		}
	}

	_setupMessageHandlers() {
		if (!this._connection) return;

		this._connection.on('message', this._handleIncomingMessage.bind(this));
		this._connection.on('close', () => logger.info('[ChatApp] Connection closed'));
		this._connection.on('error', (error) => logger.error('[ChatApp] Connection error:', error));
	}

	_handleIncomingMessage(data) {
		logger.debug('[ChatApp] Received message from server:', data);
		const handlers = {
			chat_message: (data) => {
				if (!data?.sender_id || !data?.message?.content) return;

				store.dispatch({
					domain: 'chat',
					type: chatActions.ADD_MESSAGE,
					payload: {
						friendId: data.sender_id,
						message: {
							id: data.message.id || ++this._lastMessageId,
							sender: data.sender_id,
							content: data.message.content,
							timestamp: data.message.timestamp || Date.now(),
							type: data.message.type || 'text'
						}
					}
				});

				if (!this._isChatOpen) {
					store.dispatch({
						domain: 'chat',
						type: chatActions.INCREMENT_UNREAD,
						payload: { friendId: data.sender_id }
					});
				}
			},

			friend_request: (data) => {

				let modalMessage = document.getElementById("modalMessage");
				let modalTitle = document.getElementById("messageModalLabel");

				if (data.success) {
					modalTitle.textContent = "Friend Request";
					modalMessage.innerHTML = data.data.message;
				} else {
					modalTitle.textContent = "Friend Request";
					modalMessage.innerHTML = data.error;
				}

				if (document.querySelector('.modal-backdrop')) {
					document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
				}

				// Show the modal
				let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
				messageModal.show();
			},

			game_invitation: (data) => {
				if (!data?.sender_id || !data?.room_id) return;

				// Get modal elements
				const modalElement = document.getElementById("gameInviteModal");
				const acceptButton = document.getElementById("acceptGameInviteBtn");

				if (!modalElement || !acceptButton) {
					console.error("Game invitation modal elements not found!");
					return;
				}

				// Show the Bootstrap modal
				const gameInviteModal = new Modal(modalElement);
				gameInviteModal.show();

				// Handle accept button click
				acceptButton.onclick = () => {
					gameInviteModal.hide(); // Close modal
					this._sendMessage({
						type: 'accept_game_invitation',
						sender_id: data.sender_id,
						room_id: data.room_id
					});
				};
			},

			accept_game_invitation: (data) => {
				if (data.success) {
					logger.info('Navigating to game room:', data);
					const url = `/pong/room/${data.data.room_id}/`;
					jaiPasVu.navigate(url);
				} else {
					let modalMessage = document.getElementById("modalMessage");
					let modalTitle = document.getElementById("messageModalLabel");

					modalTitle.textContent = "Game Invitation";
					modalMessage.innerHTML = data.error || 'Failed to join game. Room might be full.';

					if (document.querySelector('.modal-backdrop')) {
						document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
					}

					// Show the modal
					let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
					messageModal.show();
				}
			},

			user_profile: (object) => {
				if (!object?.data?.profile?.id) return;

				store.dispatch({
					domain: 'ui',
					type: actions.ui.SHOW_MODAL,
					payload: object?.data?.profile
				});
			},

			status_update: (data) => {
				if (!data?.user) return;

				store.dispatch({
					domain: 'chat',
					type: chatActions.UPDATE_USER,
					payload: data.user
				});
			},

			error: (data) => {
				logger.error('[ChatApp] Server error:', data.message);

				let modalMessage = document.getElementById("modalMessage");
				let modalTitle = document.getElementById("messageModalLabel");

				modalTitle.textContent = "Error";
				modalMessage.innerHTML = data.message || 'An error occurred';

				if (document.querySelector('.modal-backdrop')) {
					document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
				}

				let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
				messageModal.show();
			},

			load_friend_requests: (data) => {
				if (data.success) {
					store.dispatch({
						domain: 'ui',
						type: uiActions.LOAD_FRIEND_REQUESTS,
						payload: { requests: data.data.requests }
					});
				}
			},

			friend_request_choice: (data) => {
				let modalMessage = document.getElementById("modalMessage");
				let modalTitle = document.getElementById("messageModalLabel");

				if (data.success) {
					this.refreshUserList();
					modalTitle.textContent = "Friend Request";
					modalMessage.innerHTML = data.data.message;
				}

				if (document.querySelector('.modal-backdrop')) {
					document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
				}

				// Show the modal
				let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
				messageModal.show();

				this._sendMessage({
					type: 'load_friend_requests'
				});
			},

			remove_friend: (data) => {
				if (data.success) {
					this.refreshUserList();
					store.dispatch({
						domain: 'chat',
						type: chatActions.SET_SELECTED_USER,
					});
				}
				else {
					let modalMessage = document.getElementById("modalMessage");
					let modalTitle = document.getElementById("messageModalLabel");

					modalTitle.textContent = "Friend Request";
					modalMessage.innerHTML = data.error;

					if (document.querySelector('.modal-backdrop')) {
						document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
					}

					// Show the modal
					let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
					messageModal.show();
				}
			},

			unselect_user: (data) => {
				logger.debug('[ChatApp] Unselecting user');
				store.dispatch({
					domain: 'chat',
					type: chatActions.SET_SELECTED_USER,
				});
			},

			refresh_friends: (data) => {
				logger.debug('[ChatApp] Refreshing friends');
				this.refreshUserList();
				this._sendMessage({
					type: 'load_friend_requests'
				});
			}
		};

		const handler = handlers[data.type];
		if (handler) {
			handler(data);
		} else {
			logger.debug(`[ChatApp] Unhandled message type:`, data.type);
		}
		const messageHistory = document.querySelector("#message-history");
        if (messageHistory) {
            messageHistory.scrollTo({ top: messageHistory.scrollHeight, behavior: 'smooth' });
        }
	}

	_sendMessage(message) {
		if (!this._connection?.state?.canSend) {
			logger.warn('[ChatApp] Cannot send message - connection not ready');
			return;
		}

		// Standardize outgoing message format
		const standardizedMessage = {
			type: message.type,
			...message,
			timestamp: message.timestamp || Date.now()
		};

		try {
			this._connection.send(standardizedMessage);
		} catch (error) {
			logger.error('[ChatApp] Error sending message:', error);
		}
	}

	handleFormSubmit(e) {
		e.preventDefault();
		const messageInput = document.querySelector('#chat-message-input');
		const message = messageInput.value.trim();
		const selectedUser = store.getState('chat').selectedUser;

		if (!message || !selectedUser || selectedUser.blocked) return;

		const currentUserId = store.getState('user').id;
		if (!currentUserId) return;

		if (message.length > 300) {
			let modalMessage = document.getElementById("modalMessage");
			let modalTitle = document.getElementById("messageModalLabel");

			modalTitle.textContent = "Friend Request";
			modalMessage.innerHTML = `Message too long (${message.length}/300 characters)`;

			if (document.querySelector('.modal-backdrop')) {
				document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
			}

			// Show the modal
			let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
			messageModal.show();
			return;
		}

        fetch(`/chat/find-blocked-users/${selectedUser.id}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            logger.warn('[ChatApp] Blacklisted users:', data);
            const blocked = data['blocked'];
            logger.warn('[ChatApp] Blocked:', blocked);
            if (blocked) {
                let modalMessage = document.getElementById("modalMessage");
                let modalTitle = document.getElementById("messageModalLabel");
                modalTitle.textContent = "Blocked User";
                modalMessage.innerHTML = `You cannot send messages to this user.`;

				if (document.querySelector('.modal-backdrop')) {
					document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
				}

                let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
                messageModal.show();
                return;
            }
        })
        .catch(error => console.error('Error:', error));

		const messageId = ++this._lastMessageId;
		const timestamp = Date.now();

		// Send standardized message object to backend
		this._sendMessage({
			type: 'chat_message',
			recipient_id: selectedUser.id,
			message: {
				id: messageId,
				content: message,
				timestamp: timestamp,
				type: 'text'
			}
		});

		// Update local state
		store.dispatch({
			domain: 'chat',
			type: chatActions.ADD_MESSAGE,
			payload: {
				friendId: selectedUser.id,
				message: {
					id: messageId,
					sender: currentUserId,
					content: message,
					timestamp: timestamp,
					type: 'text'
				}
			}
		});

		messageInput.value = '';
	}

	handleFormSubmitFriendRequest(e) {
		e.preventDefault();
		const friendInput = document.querySelector('#friend-input');
		const friendUsername = friendInput.value.trim();

		if (!friendUsername) return;

		const currentUserId = store.getState('user').id;
		if (!currentUserId) return;

		logger.debug('[ChatApp] Adding friend:', friendUsername);

		// Send standardized message object to backend
		this._sendMessage({
			type: 'friend_request',
			user_id: currentUserId,
			friend_username: friendUsername
		});

		friendInput.value = '';
	}

	handleUserClick(event) {
		const userElement = event.currentTarget?.hasAttribute('data-user-id')
			? event.currentTarget
			: event.target?.closest('[data-user-id]');

		if (!userElement) return;

		const user = {
			id: Number(userElement.dataset.userId),
			username: userElement.dataset.userName || '',
			name: userElement.dataset.userName || '',
			blocked: userElement.dataset.userBlocked === 'true',
			status: userElement.dataset.userStatus || '',
			profile_picture: userElement.dataset.userPicture || '',
			online: userElement.dataset.userStatus === 'online'
		};

		if (!user.id || !user.username) return;

		store.dispatch({
			domain: 'chat',
			type: chatActions.SET_SELECTED_USER,
			payload: user
		});

		this.loadMessageHistory(user.id);
	}

	async refreshUserList() {
		try {
			const response = await fetch('/chat/users/', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) throw new Error('Failed to fetch users');

			const users = await response.json();
			store.dispatch({
				domain: 'chat',
				type: chatActions.UPDATE_USERS,
				payload: users
			});
		} catch (error) {
			logger.error('[ChatApp] Error refreshing user list:', error);
		}
	}

	loadMessageHistory(userId) {
		fetch(`/chat/history/${userId}/`, {
			method: 'GET',
			headers: {
				'X-CSRFToken': getCookie('csrftoken'),
				'Content-Type': 'application/json'
			}
		})
			.then(response => response.json())
			.then(data => {
				const messages = data.map(message => ({
					id: Number(message.id),
					sender: Number(message.sender_id),
					content: message.content,
					timestamp: message.timestamp,
					type: message.type || 'text'
				}));

				// Update last message ID
				messages.forEach(message => {
					this._lastMessageId = Math.max(this._lastMessageId, message.id);
				});

				// Clear existing history
				store.dispatch({
					domain: 'chat',
					type: actions.chat.CLEAR_HISTORY,
					payload: { friendId: userId }
				});

				// Add all messages at once
				store.dispatch({
					domain: 'chat',
					type: actions.chat.ADD_MESSAGES,
					payload: {
						friendId: userId,
						messages
					}
				});
				const messageHistory = document.querySelector("#message-history");
				if (messageHistory) {
					messageHistory.scrollTo({ top: messageHistory.scrollHeight, behavior: 'smooth' });
				}
			})
			.catch(error => {
				logger.error(`[ChatApp] Error loading message history:`, error);
			});
	}

	handleSpecialActions(e) {
		const userId = Number(e.currentTarget.dataset.userId);
		const isInvitePong = e.currentTarget.classList.contains('invite-pong');
		const isViewProfile = e.currentTarget.classList.contains('view-profile');
		const isBlock = e.currentTarget.classList.contains('block-user');
		const isUnblock = e.currentTarget.classList.contains('unblock-user');

		if (isInvitePong) {
			this._sendMessage({
				type: 'game_invitation',
				recipient_id: userId,
				game_id: 'pong'
			});
			let modalMessage = document.getElementById("modalMessage");
			let modalTitle = document.getElementById("messageModalLabel");

			modalTitle.textContent = "Game Invitation Request";
			modalMessage.innerHTML = 'Game invitation sent!';

			if (document.querySelector('.modal-backdrop')) {
				document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
			}

			let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
			messageModal.show();
		} else if (isViewProfile) {
			this._sendMessage({
				type: 'get_profile',
				user_id: userId
			});
		} else if (isBlock || isUnblock) {
			this.handleBlockAction(userId, isBlock);
		}
	}

	handleBlockAction(userId, isBlock) {
		const action = isBlock ? 'block' : 'unblock';
		const method = isBlock ? 'POST' : 'DELETE';

		fetch(`/chat/${action}/${userId}/`, {
			method: method,
			headers: {
				'X-CSRFToken': getCookie('csrftoken'),
				'Content-Type': 'application/json'
			}
		})
			.then(async response => {
				const contentType = response.headers.get('content-type');
				if (contentType && contentType.includes('application/json')) {
					return response.json();
				}
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return { success: true };
			})
			.then(data => {
				if (data.success) {
					// Update local state
					const chatState = store.getState('chat');
					const users = chatState.users.map(user => {
						if (user.id === userId) {
							return { ...user, blocked: isBlock };
						}
						return user;
					});

					store.dispatch({
						domain: 'chat',
						type: chatActions.UPDATE_USERS,
						payload: users
					});

					store.dispatch({
						domain: 'chat',
						type: chatActions.SET_SELECTED_USER,
					});

					// Refresh the user list to update statuses and buttons
					this.refreshUserList();
				} else {
					throw new Error('Server returned unsuccessful response');
				}
			})
			.catch(error => {
				logger.error(`[ChatApp] Error handling block action:`, error);
				let modalMessage = document.getElementById("modalMessage");
				let modalTitle = document.getElementById("messageModalLabel");

				modalTitle.textContent = "Block User";
				modalMessage.innerHTML = `Failed to ${action} user. Please try again.`;

				if (document.querySelector('.modal-backdrop')) {
					document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
				}

				let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
				messageModal.show();
			});
	}

	setChatModalOpen(isOpen) {
		this._isChatOpen = isOpen;

		if (isOpen) {
			// Clear all unread counts when opening chat
			store.dispatch({
				domain: 'chat',
				type: chatActions.CLEAR_UNREAD
			});
		}
	}

	destroy() {
		connectionManager.removeConnectionGroup('chat');
		this._connection = null;
	}

	async selectLastActiveChat() {
		const chatState = store.getState('chat');
		if (!chatState) return;

		// Find the room with the most recent message
		let lastActiveRoom = null;
		let lastMessageTime = 0;

		Object.entries(chatState.messages).forEach(([friendId, messages]) => {
			if (messages && messages.length > 0) {
				const lastMessage = messages[messages.length - 1];
				if (lastMessage.timestamp > lastMessageTime) {
					lastMessageTime = lastMessage.timestamp;
					lastActiveRoom = Number(friendId);
				}
			}
		});

		if (lastActiveRoom) {
			const userButton = document.querySelector(`.user-chat[data-user-id="${lastActiveRoom}"]`);
			if (userButton) {
				userButton.click();
			}
		}
	}

	// Vue template handlers
	selectUser(userId) {
		logger.debug('[ChatApp] Selecting user with ID:', userId);
		const user = store.getState('chat').users.find(u => u.id === userId);

		if (!user) {
			logger.error('[ChatApp] User not found with ID:', userId);
			return;
		}

		store.dispatch({
			domain: 'chat',
			type: chatActions.SET_SELECTED_USER,
			payload: user
		});
		this.loadMessageHistory(user.id);
		// Persister l'état
		localStorage.setItem('selectedChatUser', JSON.stringify(user));
	}

	init() {
		// Restaurer l'état au chargement
		const savedUser = localStorage.getItem('selectedChatUser');
		if (savedUser) {
			try {
				const user = JSON.parse(savedUser);
				store.dispatch({
					domain: 'chat',
					type: chatActions.SET_SELECTED_USER,
					payload: user
				});
			} catch (e) {
				logger.error('Error restoring selected user', e);
			}
		}
		// ... existing init code ...
	}

	blockUser() {
		const userId = store.getState('chat').selectedUser.id;
		this.handleBlockAction(userId, true);
	}

	unblockUser() {
		const userId = store.getState('chat').selectedUser.id;
		this.handleBlockAction(userId, false);
	}

	inviteToGame() {
		const userId = store.getState('chat').selectedUser.id;
		let roomState = store.getState('room');
		if (!roomState.id) {
			let modalMessage = document.getElementById("modalMessage");
			let modalTitle = document.getElementById("messageModalLabel");

			modalTitle.textContent = "Pong Game";
			modalMessage.innerHTML = 'No room found';

			if (document.querySelector('.modal-backdrop')) {
				document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
			}

			let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
			messageModal.show();
			return;
		}
		this._sendMessage({
			type: 'game_invitation',
			recipient_id: userId,
			room_id: roomState.id
		});
		let modalMessage = document.getElementById("modalMessage");
		let modalTitle = document.getElementById("messageModalLabel");

		modalTitle.textContent = "Pong Game";
		modalMessage.innerHTML = 'Game invitation sent!';

		if (document.querySelector('.modal-backdrop')) {
			document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
		}

		let messageModal = new bootstrap.Modal(document.getElementById("messageModal"));
		messageModal.show();
	}

	removeFriend() {
		if (document.querySelector('.modal-backdrop')) {
			document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
		}
		// Show the Bootstrap modal
		let modal = new bootstrap.Modal(document.getElementById('removeFriendModal'));
		modal.show();

		// Handle click event on the "Remove" button
		document.getElementById('confirmRemoveFriend').onclick = () => {
			const userId = store.getState('chat').selectedUser.id;
			logger.debug('[ChatApp] Removing friend with ID:', userId);
			this._sendMessage({
				type: 'remove_friend',
				friend_id: userId
			});

			// Hide the modal after confirming
			modal.hide();
		};
	}

	viewProfile() {
		const userId = store.getState('chat').selectedUser.id;
		this._sendMessage({
			type: 'get_profile',
			user_id: userId
		});
	}

	formatTimestamp(timestamp) {
		return new Date(timestamp).toLocaleTimeString();
	}

	static sendMessage(message) {
		if (!this.#instance) {
			logger.error('ChatApp not initialized');
			return;
		}
		this.#instance._sendMessage(message);
	}
}
