import logger from '../logger.js';
import UserService from './UserService.js';
import MessageService from './MessageService.js';
import UIHandler from './UIHandler.js';
import { ChatNetworkManager } from './ChatNetworkManager.js';
import Store from '../state/store.js';

export default class ChatApp {
	constructor() {
		this._store = Store.getInstance();
		this.networkManager = new ChatNetworkManager();
		this.userService = new UserService(this);
		this.uiHandler = new UIHandler(this);
		this.messageService = new MessageService(this.uiHandler, this.userService);
		this.initializeNetwork();
		this._initializeStoreSubscription();
	}

	async initializeNetwork() {
		this.networkManager.on('chat_message', data => {
			this._store.dispatch({
				domain: 'chat',
				type: 'ADD_MESSAGE',
				payload: {
					roomId: data.sender_id,
					message: {
						id: Date.now().toString(),
						sender: data.sender_id,
						content: data.message,
						timestamp: data.timestamp || Date.now(),
						type: 'text'
					}
				}
			});
		});

		this.networkManager.on('game_invitation', data => {
			this.handleGameInvitation(data.game_id, data.sender_id);
		});

		this.networkManager.on('tournament_warning', data => {
			this.handleTournamentWarning(data.tournament_id, data.match_time);
		});

		this.networkManager.on('user_profile', data => {
			this.uiHandler.displayProfileModal(data.profile);
		});

		this.networkManager.on('user_status_change', data => {
			this._store.dispatch({
				domain: 'user',
				type: 'UPDATE_STATUS',
				payload: {
					userId: data.user_id,
					status: data.status
				}
			});
			this.userService.refreshUserList();
		});

		this.networkManager.on('error', data => {
			alert("Error: " + data.error);
		});

		await this.networkManager.connect();
	}

	_initializeStoreSubscription() {
		this._store.subscribe('chat', (chatState) => {
			if (chatState.activeRoom) {
				const messages = chatState.messages[chatState.activeRoom] || [];
				this.uiHandler.updateMessages(messages);
				this.uiHandler.updateUnreadCount(chatState.unreadCounts[chatState.activeRoom] || 0);
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

		const recipientId = activeUser.dataset.userId;
		const currentUserId = this._store.getState('user').id;
		if (!currentUserId) {
			alert("Unable to send message. User ID not found.");
			return;
		}

		logger.info(`Sending message to user ${recipientId}: ${message}`);
		this.networkManager.sendMessage({
			type: 'chat_message',
			message: message,
			recipient_id: recipientId
		});

		this._store.dispatch({
			domain: 'chat',
			type: 'ADD_MESSAGE',
			payload: {
				roomId: recipientId,
				message: {
					id: Date.now().toString(),
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
		const userId = button.dataset.userId;

		document.querySelectorAll('.user-chat').forEach(btn => {
			btn.classList.remove('active');
		});
		button.classList.add('active');

		this._store.dispatch({
			domain: 'chat',
			type: 'SET_ACTIVE_ROOM',
			payload: userId
		});

		this.loadMessageHistory(userId);
		document.getElementById('chat-form-div').style.display = 'block';
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
					id: message.id || Date.now().toString(),
					sender: message.sender_id,
					content: message.content,
					timestamp: new Date(message.timestamp).getTime(),
					type: 'text'
				}));

				this._store.dispatch({
					domain: 'chat',
					type: 'ADD_MESSAGE',
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
		const userId = e.currentTarget.dataset.userId;
		const isInvitePong = e.currentTarget.classList.contains('invite-pong');
		const type = isInvitePong ? 'game_invitation' : 'get_profile';

		const payload = isInvitePong
			? { type: 'game_invitation', recipient_id: userId, game_id: 'pong' }
			: { type: 'user_profile', user_id: userId };

		this.networkManager.sendMessage(payload);
	}

	handleGameInvitation(gameId, senderId) {
		if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`)) {
			window.location.href = `/games/${gameId}/?opponent=${senderId}`;
		}
	}

	handleTournamentWarning(tournamentId, matchTime) {
		alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
	}

	setChatModalOpen(isOpen) {
		if (isOpen && this._store.getState('chat').activeRoom) {
			this._store.dispatch({
				domain: 'chat',
				type: 'SET_ACTIVE_ROOM',
				payload: this._store.getState('chat').activeRoom
			});
		}
	}

	destroy() {
		this.networkManager.destroy();
	}
}
