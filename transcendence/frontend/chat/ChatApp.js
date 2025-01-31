import logger from '../logger.js';
import UserService from './UserService.js';
import MessageService from './MessageService.js';
import UIHandler from './UIHandler.js';
import { ChatNetworkManager } from './ChatNetworkManager.js';
import { store, actions } from '../state/store.js';

export default class ChatApp {
	static instance = null;

	constructor() {
		if (ChatApp.instance) {
			logger.debug('ChatApp instance already exists');
			return ChatApp.instance;
		}

		this.networkManager = new ChatNetworkManager();
		this.userService = new UserService(this);
		this.uiHandler = new UIHandler(this);
		this.messageService = new MessageService(this.uiHandler, this.userService);
		this._lastMessageId = 0;
		this._isChatOpen = false;
		this.initializeNetwork();
		this._initializeStoreSubscription();
		this.selectLastActiveChat();

		ChatApp.instance = this;
	}

	static getInstance() {
		if (!ChatApp.instance) {
			ChatApp.instance = new ChatApp();
		}
		return ChatApp.instance;
	}

	static hasInstance() {
		return !!ChatApp.instance;
	}

	static resetInstance() {
		ChatApp.instance = null;
	}

	async initializeNetwork() {
		try {
			const chatState = store.getState('chat');
			const userState = store.getState('user');

			// Ensure chat state is initialized
			if (!chatState || !chatState.users) {
				logger.debug('Chat state not initialized yet, waiting...');
				setTimeout(() => this.initializeNetwork(), 100);
				return;
			}

			// Rest of the initialization code...
			const currentUser = userState.id;
			const blockedUsers = userState.blockedUsers;

			// Filter out blocked users
			const allowedUsers = Object.values(chatState.users).filter(user =>
				user.id !== currentUser && !blockedUsers.has(user.id)
			);

			// Initialize network manager
			this._networkManager = new ChatNetworkManager(this);
			this._networkManager.connect();

			logger.debug('Chat network initialized successfully');
		} catch (error) {
			logger.error('Error initializing chat network:', error);
		}
	}

	_initializeStoreSubscription() {
		store.subscribe('chat', (chatState) => {
			// Calculate total unread count across all rooms
			const totalUnread = Object.values(chatState.unreadCounts).reduce((sum, count) => sum + count, 0);
			this.uiHandler.updateUnreadCount(totalUnread);

			// Update messages for active room
			if (chatState.activeRoom) {
				const messages = chatState.messages[chatState.activeRoom] || [];
				this.uiHandler.updateMessages(messages);
			}
		});
	}

	handleFormSubmit(e) {
		e.preventDefault();
		const messageInput = document.querySelector('#chat-message');
		const message = messageInput.value.trim();
		if (!message) return;

		const activeUser = document.querySelector('.user-chat.active');
		if (!activeUser) {
			alert("Please select a user to chat with.");
			return;
		}

		// TODO: condition en trop ? Server blocke deja
		if (activeUser.classList.contains('blocked')) {
			alert("This user has blocked you. You cannot send them messages.");
			messageInput.value = '';
			return;
		}

		const recipientId = Number(activeUser.dataset.userId);
		const currentUserId = store.getState('user').id;
		if (!currentUserId) {
			alert("Unable to send message. User ID not found.");
			return;
		}

		this._lastMessageId++;
		const messageId = this._lastMessageId;

		logger.info(`Sending message to user ${recipientId}: ${message}`);
		this.networkManager.sendMessage({
			type: 'chat_message',
			message: message,
			recipient_id: recipientId,
			id: messageId
		});

		store.dispatch({
			domain: 'chat',
			type: 'ADD_MESSAGE',
			payload: {
				roomId: recipientId,
				message: {
					id: messageId,
					sender: currentUserId,
					content: message,
					timestamp: Date.now(),
					type: 'text'
				}
			}
		});

		messageInput.value = '';
	}

	handleUserClick(event) {
		const button = event.currentTarget;
		const userState = store.getState('user');
		const userId = userState.id;
		const userName = userState.username;
		const isBlocked = button.classList.contains('blocked');

		document.querySelectorAll('.user-chat').forEach(btn => {
			btn.classList.remove('active');
		});
		button.classList.add('active');

		// Update chat header with user name
		const chatHeading = document.getElementById('chatHeading');
		if (chatHeading)
			chatHeading.textContent = userName;

		// Show chat form and update input state
		const chatFormDiv = document.getElementById('chat-form-div');
		if (chatFormDiv) {
			chatFormDiv.style.display = 'block';
			const chatInput = document.querySelector('#chat-message');
			const sendButton = document.querySelector('#button-addon2');
			if (chatInput && sendButton) {
				if (isBlocked) {
					chatInput.disabled = true;
					chatInput.placeholder = "This user has blocked you";
					sendButton.disabled = true;
				} else {
					chatInput.disabled = false;
					chatInput.placeholder = "Type your message...";
					sendButton.disabled = false;
				}
			}
		}

		// Clear unread count for this specific user
		const chatState = store.getState('chat');
		if (chatState.unreadCounts[userId]) {
			const newUnreadCounts = { ...chatState.unreadCounts };
			delete newUnreadCounts[userId];
			store.dispatch({
				domain: 'chat',
				type: actions.chat.SET_ACTIVE_ROOM,
				payload: userId,
				unreadCounts: newUnreadCounts
			});
		} else {
			store.dispatch({
				domain: 'chat',
				type: actions.chat.SET_ACTIVE_ROOM,
				payload: userId
			});
		}

		this.loadMessageHistory(userId);
	}

	loadMessageHistory(userId) {
		fetch(`/chat/history/${userId}/`, {
			method: 'GET',
			headers: {
				'X-CSRFToken': this.networkManager.getCSRFToken(),
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
					payload: { roomId: userId }
				});

				// Add all messages at once
				store.dispatch({
					domain: 'chat',
					type: actions.chat.ADD_MESSAGES,
					payload: {
						roomId: userId,
						messages
					}
				});
			})
			.catch(error => {
				logger.error('Error loading message history:', error);
			});
	}

	handleSpecialActions(e) {
		const userId = Number(e.currentTarget.dataset.userId);
		const isInvitePong = e.currentTarget.classList.contains('invite-pong');
		const isViewProfile = e.currentTarget.classList.contains('view-profile');
		const isBlock = e.currentTarget.classList.contains('block-user');
		const isUnblock = e.currentTarget.classList.contains('unblock-user');

		if (isInvitePong) {
			this.networkManager.sendMessage({
				type: 'game_invitation',
				recipient_id: userId,
				game_id: 'pong' // TODO: send actual game id
			});
			alert('Game invitation sent!');
		} else if (isViewProfile) {
			this.networkManager.sendMessage({
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
				'X-CSRFToken': this.networkManager.getCSRFToken(),
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
					// Refresh the user list to update statuses and buttons
					this.userService.refreshUserList();
				} else {
					throw new Error('Server returned unsuccessful response');
				}
			})
			.catch(error => {
				logger.error('Error handling block action:', error);
				alert(`Failed to ${action} user. Please try again.`);
			});
	}

	handleGameInvitation(gameId, senderId, roomId) {
		if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`)) {
			// Accept invitation and join room
			this.networkManager.sendMessage({
				type: 'accept_game_invitation',
				sender_id: senderId,
				game_id: gameId,
				room_id: roomId
			});
		}
	}

	handleTournamentWarning(tournamentId, matchTime) {
		alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
	}

	setChatModalOpen(isOpen) {
		this._isChatOpen = isOpen;

		if (isOpen) {
			// Clear all unread counts when opening chat
			store.dispatch({
				domain: 'chat',
				type: actions.chat.CLEAR_ALL_UNREAD
			});
		}
	}

	destroy() {
		this.networkManager.destroy();
	}

	async selectLastActiveChat() {
		const chatState = store.getState('chat');
		if (!chatState) return;

		// Find the room with the most recent message
		let lastActiveRoom = null;
		let lastMessageTime = 0;

		Object.entries(chatState.messages).forEach(([roomId, messages]) => {
			if (messages && messages.length > 0) {
				const lastMessage = messages[messages.length - 1];
				if (lastMessage.timestamp > lastMessageTime) {
					lastMessageTime = lastMessage.timestamp;
					lastActiveRoom = Number(roomId);
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
}
