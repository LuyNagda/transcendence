import logger from '../utils/logger.js';
import UserService from './UserService.js';
import MessageService from './MessageService.js';
import UIHandler from './UIHandler.js';
import { ChatNetworkManager } from './ChatNetworkManager.js';

export default class ChatApp {
	constructor() {
		this.networkManager = new ChatNetworkManager();
		this.userService = new UserService(this);
		this.uiHandler = new UIHandler(this);
		this.messageService = new MessageService(this.uiHandler, this.userService);
		this.messageCountByUser = {};
		this.initializeNetwork();
	}

	async initializeNetwork() {
		this.networkManager.on('chat_message', data => {
			this.messageService.addMessage(data.message, data.sender_id, data.timestamp, false);
			if (!this.chatModalOpen) this.incrementUnreadMessageCount();
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
			this.userService.updateUserStatus(data.user_id, data.status);
			this.userService.refreshUserList();
		});

		this.networkManager.on('error', data => {
			alert("Error: " + data.error);
		});

		await this.networkManager.connect();
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
		if (!this.userService.currentUserId) {
			alert("Unable to send message. User ID not found.");
			return;
		}

		logger.info(`Sending message to user ${recipientId}: ${message}`);
		this.networkManager.sendMessage({
			type: 'chat_message',
			message: message,
			recipient_id: recipientId
		});

		this.messageService.addMessage(message, this.userService.currentUserId, new Date(), true);
		messageInput.value = '';
	}

	handleUserClick(event) {
		const button = event.currentTarget;
		const userId = parseInt(button.dataset.userId);

		this.userService.selectedUserId = userId;
		document.querySelectorAll('.user-chat').forEach(btn => {
			btn.classList.remove('active');
		});
		button.classList.add('active');
		this.loadMessageHistory(userId);
		document.getElementById('chat-form-div').style.display = 'block';
		this.updateChatHeading(userId);
		this.messageCountByUser[userId] = 0;
		this.uiHandler.updateChatIcon(0);
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
				this.uiHandler.messageHistory.innerHTML = '';
				this.messageCountByUser[userId] = data.length;
				logger.debug("Message history loaded:", data);
				data.forEach(message => {
					try {
						const isSent = message.sender_id === this.userService.currentUserId;
						this.messageService.addMessage(message.content, message.sender_id, new Date(message.timestamp), isSent);
					} catch (error) {
						logger.error('Error adding message:', error);
					}
				});
				this.uiHandler.messageHistory.scrollTop = this.uiHandler.messageHistory.scrollHeight;
				this.updateChatHeading(userId);
			})
			.catch(error => {
				logger.error('Error loading message history:', error);
			});
	}

	updateChatHeading(userId) {
		const userName = this.userService.getUserName(userId);
		const messageCount = this.messageCountByUser[userId] || 0;
		this.uiHandler.updateChatHeading(userName, messageCount);
	}

	handleUserBlockToggle(e) {
		e.preventDefault();
		const element = e.currentTarget;
		const userId = element.dataset.userId;
		const action = element.classList.contains('block-user') ? 'block' : 'unblock';
		const method = action === 'block' ? 'POST' : 'DELETE';

		fetch(`/chat/${action}/${userId}/`, {
			method: method,
			headers: {
				'X-CSRFToken': this.networkManager.getCSRFToken(),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		})
			.then(response => {
				if (response.ok) return response.json();
				throw new Error('Network response was not ok.');
			})
			.then(data => {
				if (data.success) {
					if (action === 'block') {
						element.textContent = 'Unblock';
						element.classList.remove('block-user', 'btn-danger');
						element.classList.add('unblock-user', 'btn-secondary');
					} else {
						element.textContent = 'Block';
						element.classList.remove('unblock-user', 'btn-secondary');
						element.classList.add('block-user', 'btn-danger');
					}
					this.userService.updateUserStatus(userId, action === 'block' ? 'blocked' : 'online');
				}
			})
			.catch(error => {
				logger.error('Error:', error);
				alert('An error occurred while processing your request.');
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

	incrementUnreadMessageCount() {
		this.unreadMessageCount++;
		this.uiHandler.updateChatIcon(this.unreadMessageCount);
	}

	resetUnreadMessageCount() {
		this.unreadMessageCount = 0;
		this.uiHandler.updateChatIcon(this.unreadMessageCount);
	}

	setChatModalOpen(isOpen) {
		this.chatModalOpen = isOpen;
		if (isOpen) {
			this.resetUnreadMessageCount();
		}
	}

	destroy() {
		this.networkManager.destroy();
	}
}
