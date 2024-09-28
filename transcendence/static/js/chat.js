if (typeof ChatApp === 'undefined') {
	class ChatApp {
		constructor() {
			this.chatSocket = null;
			this.messageQueue = [];
			this.reconnectAttempts = 0;
			this.maxReconnectAttempts = 5;
			this.unreadMessageCount = 0;
			this.chatModalOpen = false;
			this.MessageHistory = document.getElementById('message-history');
			this.selectedUserId = null;
			this.messageCountByUser = {};
			this.currentUserId = this.getCurrentUserId();
			this.init();
		}

		init() {
			this.createWebSocketConnection();
			this.attachEventListeners();
			this.setupChatModalListeners();
		}

		createWebSocketConnection() {
			const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
			const wsUrl = `${protocol}${window.location.host}/ws/chat/`;
			this.chatSocket = new WebSocket(wsUrl);
			this.setupWebSocketHandlers();
		}

		setupWebSocketHandlers() {
			this.chatSocket.onmessage = (e) => this.handleMessage(e);
			this.chatSocket.onclose = (e) => this.handleClose(e);
			this.chatSocket.onerror = (err) => this.handleError(err);
			this.chatSocket.onopen = () => {
				logger.debug('WebSocket connection established');
				this.reconnectAttempts = 0;
				this.processMessageQueue();
			};
		}

		setupChatModalListeners() {
			const ChatCanvas = document.getElementById('ChatCanvas');
			if (ChatCanvas) {
				ChatCanvas.addEventListener('show.bs.offcanvas', () => {
					this.chatModalOpen = true;
					this.resetUnreadMessageCount();
				});
				ChatCanvas.addEventListener('hide.bs.offcanvas', () => {
					this.chatModalOpen = false;
				});
			}
		}

		handleMessage(e) {
			const data = JSON.parse(e.data);
			logger.debug("Received data:", data);
			switch (data.type) {
				case 'chat_message':
					this.addMessage(data.message, data.sender_id);
					if (!this.chatModalOpen)
						this.incrementUnreadMessageCount();
					break;
				case 'game_invitation':
					this.handleGameInvitation(data.game_id, data.sender_id);
					break;
				case 'tournament_warning':
					this.handleTournamentWarning(data.tournament_id, data.match_time);
					break;
				case 'user_profile':
					this.displayUserProfile(data.profile);
					break;
				case 'user_status_change':
					this.updateUserStatus(data.user_id, data.status);
					break;
				case 'error':
					alert("Error: " + data.error);
					break;
			}
		}

		handleClose(e) {
			logger.warn(`WebSocket closed. Code: ${e.code}, Reason: ${e.reason}`);
			if (this.reconnectAttempts < this.maxReconnectAttempts) {
				const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
				logger.info(`Reconnect attempt ${this.reconnectAttempts + 1} will be made in ${delay}ms`);
				setTimeout(() => {
					this.reconnectAttempts++;
					this.createWebSocketConnection();
				}, delay);
			} else
				logger.error('Max reconnect attempts reached. Please refresh the page.');
		}

		handleError(err) {
			logger.error('WebSocket error:', err);
		}

		attachEventListeners() {
			document.querySelector('#chat-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
			document.querySelectorAll('.user-chat').forEach(element => {
				element.addEventListener('click', (e) => this.handleUserClick(e));
			});
			document.querySelectorAll('.block-user, .unblock-user').forEach(element => {
				element.addEventListener('click', (e) => this.handleUserBlockToggle(e));
			});
			document.querySelectorAll('.invite-pong, .view-profile').forEach(element => {
				element.addEventListener('click', (e) => this.handleSpecialActions(e));
			});
		}

		handleFormSubmit(e) {
			e.preventDefault();
			const messageInput = document.querySelector('#chat-message');
			const message = messageInput.value;
			const activeUser = document.querySelector('.user-chat.active');
			if (!activeUser) {
				alert("Please select a user to chat with.");
				return;
			}
			const recipientId = activeUser.dataset.userId;
			if (!this.currentUserId) {
				alert("Unable to send message. User ID not found.");
				return;
			}
			logger.info(`Sending message to user ${recipientId} : ${message}`);
			this.sendMessage({
				'type': 'chat_message',
				'message': message,
				'recipient_id': recipientId
			});
			this.addMessage(message, this.currentUserId, new Date());
			messageInput.value = '';
		}

		handleUserClick(e) {
			e.preventDefault();
			const userId = e.currentTarget.dataset.userId;
			this.selectedUserId = userId;
			document.querySelectorAll('.user-chat').forEach(el => el.classList.remove('active'));
			e.currentTarget.classList.add('active');
			this.loadMessageHistory(userId);
			document.getElementById('chat-form-div').style.display = 'block';
			this.updateChatHeading(userId);
			// Reset message count for this user
			this.messageCountByUser[userId] = 0;
		}

		loadMessageHistory(userId) {
			fetch(`/chat/history/${userId}/`, {
				method: 'GET',
				headers: {
					'X-CSRFToken': this.getCSRFToken(),
					'Content-Type': 'application/json'
				}
			})
				.then(response => response.json())
				.then(data => {
					this.MessageHistory.innerHTML = '';
					this.messageCountByUser[userId] = data.length;
					logger.debug("Message history loaded:", data);
					data.forEach(message => {
						try {
							this.addMessage(message.content, message.sender_id, new Date(message.timestamp));
						} catch (error) {
							logger.error('Error adding message:', error);
						}
					});
					this.MessageHistory.scrollTop = this.MessageHistory.scrollHeight;
					this.updateChatHeading(userId);
				})
				.catch(error => {
					logger.error('Error loading message history:', error);
				});
		}

		updateChatHeading(userId) {
			const ChatHeading = document.getElementById('chatHeading');
			const UnreadBadge = document.getElementById('unreadBadge');
			const messageCount = this.messageCountByUser[userId] || 0;
			const userName = document.querySelector(`.user-chat[data-user-id="${userId}"]`).textContent.trim();
			ChatHeading.textContent = `Chat with ${userName}`;
			UnreadBadge.textContent = messageCount;

			const visuallyHiddenElement = UnreadBadge.querySelector('.visually-hidden');
			if (visuallyHiddenElement) {
				visuallyHiddenElement.textContent = `${messageCount} messages`;
			} else {
				const span = document.createElement('span');
				span.className = 'visually-hidden';
				span.textContent = `${messageCount} messages`;
				UnreadBadge.appendChild(span);
			}
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
					'X-CSRFToken': this.getCSRFToken(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({}) // Include any necessary data
			})
				.then(response => {
					if (response.ok)
						return response.json();
					throw new Error('Network response was not ok.');
				})
				.then(data => {
					if (data.success) {
						// Toggle button text and class
						if (action === 'block') {
							element.textContent = 'Unblock';
							element.classList.remove('block-user', 'btn-danger');
							element.classList.add('unblock-user', 'btn-secondary');
						} else {
							element.textContent = 'Block';
							element.classList.remove('unblock-user', 'btn-secondary');
							element.classList.add('block-user', 'btn-danger');
						}
						// Update user status
						this.updateUserStatus(userId, action === 'block' ? 'blocked' : 'online');
					}
				})
				.catch(error => {
					logger.error('Error:', error);
					alert('An error occurred while processing your request.');
				});
		}

		getCSRFToken() {
			const cookieValue = document.cookie
				.split('; ')
				.find(row => row.startsWith('csrftoken='));
			return cookieValue ? cookieValue.split('=')[1] : null;
		}

		handleSpecialActions(e) {
			const userId = e.currentTarget.dataset.userId;
			const type = e.currentTarget.classList.contains('invite-pong') ? 'game_invitation' : 'get_profile';
			const payload = {
				'type': type,
				'recipient_id': userId
			};
			if (type === 'game_invitation')
				payload.game_id = 'pong';
			if (type === 'get_profile') {
				delete payload.recipient_id;
				payload.user_id = userId;
			}
			this.sendMessage(payload);
		}

		sendMessage(payload) {
			const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
			if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
				this.chatSocket.send(message);
			} else {
				logger.warn('WebSocket not connected. Queueing message.');
				this.messageQueue.push(message);
				if (this.chatSocket.readyState === WebSocket.CLOSED) {
					this.createWebSocketConnection();
				}
			}
		}

		processMessageQueue() {
			while (this.messageQueue.length > 0) {
				const message = this.messageQueue.shift();
				this.sendMessage(message);
			}
		}

		updateUserStatus(userId, status) {
			logger.info(`Updating user status: ${userId}, Status: ${status}`);
			const UserElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
			if (UserElement) {
				const statusIcon = UserElement.querySelector('.status-icon');
				if (status === 'online') {
					statusIcon.innerHTML = '&#x1F7E2;'; // Green circle
					UserElement.classList.add('online');
					UserElement.classList.remove('offline', 'blocked');
				} else if (status === 'offline') {
					statusIcon.innerHTML = '&#x26AA;'; // White circle
					UserElement.classList.add('offline');
					UserElement.classList.remove('online', 'blocked');
				} else if (status === 'blocked') {
					statusIcon.innerHTML = '&#x1F534;'; // Red circle
					UserElement.classList.add('blocked');
					UserElement.classList.remove('online', 'offline');
				}

				// Update status indicators in message bubbles
				this.updateMessageBubblesStatus(userId, status);
			}
		}

		addMessage(message, senderId, timestamp = null) {
			senderId = parseInt(senderId, 10);

			const Message = document.createElement('div');
			Message.classList.add('chat-bubble');
			Message.setAttribute('data-user-id', senderId); // Add data-user-id attribute

			if (!this.currentUserId) {
				logger.error('Current user ID is not set. Unable to determine message sender.');
				return;
			}

			const isSent = senderId === this.currentUserId;
			Message.classList.add(isSent ? 'sent' : 'received');

			let senderName = isSent ? 'You' : 'Unknown User';
			if (!isSent) {
				const userElement = document.querySelector(`.user-chat[data-user-id="${senderId}"]`);
				if (userElement)
					senderName = userElement.querySelector('.user-name').textContent.trim();
				else
					logger.warn('User element not found for ID:', senderId);
			}

			let formattedTimestamp = 'Just now';
			if (timestamp) {
				const date = new Date(timestamp);
				if (!isNaN(date.getTime()))
					formattedTimestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			} else
				formattedTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

			// Conditionally include the status icon only for received messages
			const statusIconHTML = !isSent ? `
				<span class="status-icon" aria-label="User status">
					${this.getUserStatusIcon(senderId)}
				</span>
			` : '';

			Message.innerHTML = `
				<div class="message-header">
					<span class="sender-name">${senderName}</span>
					${statusIconHTML}
				</div>
				<p>${message}</p>
				<small>${formattedTimestamp}</small>
			`;

			this.MessageHistory.appendChild(Message);
			this.MessageHistory.scrollTop = this.MessageHistory.scrollHeight;

			if (senderId === this.selectedUserId || isSent) {
				this.messageCountByUser[this.selectedUserId] = (this.messageCountByUser[this.selectedUserId] || 0) + 1;
				this.updateChatHeading(this.selectedUserId);
			}
		}

		handleGameInvitation(gameId, senderId) {
			if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`))
				window.location.href = `/games/${gameId}/?opponent=${senderId}`;
		}

		handleTournamentWarning(tournamentId, matchTime) {
			alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
		}

		displayUserProfile(profile) {
			const ExistingProfileModal = document.querySelector('.profile-modal');
			if (ExistingProfileModal)
				document.body.removeChild(ExistingProfileModal);

			const ProfileModal = document.createElement('div');
			ProfileModal.classList.add('profile-modal');
			ProfileModal.innerHTML = `
				<h2>${profile.username}'s Profile</h2>
				<p>Email: ${profile.email}</p>
				<p>Bio: ${profile.bio}</p>
				<img src="${profile.profile_picture}" alt="Profile Picture"> <!-- Display profile picture if available -->
			`;
			document.body.appendChild(ProfileModal);

			ProfileModal.addEventListener('click', function () {
				document.body.removeChild(ProfileModal);
			});
		}

		incrementUnreadMessageCount() {
			this.unreadMessageCount++;
			this.updateChatIcon();
		}

		resetUnreadMessageCount() {
			this.unreadMessageCount = 0;
			this.updateChatIcon();
		}

		updateChatIcon() {
			const ChatIcon = document.querySelector('.chat-icon i');
			const ChatBadge = document.querySelector('.chat-badge');

			if (ChatIcon && ChatBadge) {
				if (this.unreadMessageCount > 0) {
					ChatIcon.classList.remove('text-secondary');
					ChatIcon.classList.add('text-primary');
					ChatBadge.textContent = this.unreadMessageCount > 99 ? '99+' : this.unreadMessageCount;
					ChatBadge.style.display = 'inline';
				} else {
					ChatIcon.classList.remove('text-primary');
					ChatIcon.classList.add('text-secondary');
					ChatBadge.style.display = 'none';
				}
			}
		}

		getCurrentUserId() {
			const userId = document.body.dataset.userId;
			if (!userId) {
				logger.error('User ID not found in body dataset. Make sure to set data-user-id on the body element.');
				return null;
			}
			return parseInt(userId, 10);
		}

		updateMessageBubblesStatus(userId, status) {
			const MessageBubbles = document.querySelectorAll(`.chat-bubble[data-user-id="${userId}"] .status-icon`);
			MessageBubbles.forEach((icon) => {
				if (status === 'online') {
					icon.innerHTML = '&#x1F7E2;'; // Green circle
					icon.classList.add('online');
					icon.classList.remove('offline', 'blocked');
				} else if (status === 'offline') {
					icon.innerHTML = '&#x26AA;'; // White circle
					icon.classList.add('offline');
					icon.classList.remove('online', 'blocked');
				} else if (status === 'blocked') {
					icon.innerHTML = '&#x1F534;'; // Red circle
					icon.classList.add('blocked');
					icon.classList.remove('online', 'offline');
				}
			});
		}

		getUserStatusIcon(userId) {
			const status = this.getUserStatus(userId);
			switch (status) {
				case 'online':
					return '&#x1F7E2;'; // Green circle
				case 'offline':
					return '&#x26AA;'; // White circle
				case 'blocked':
					return '&#x1F534;'; // Red circle
				default:
					return '&#x26AA;'; // Default to offline (white circle)
			}
		}

		getUserStatus(userId) {
			const UserElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
			if (UserElement) {
				if (UserElement.classList.contains('online'))
					return 'online';
				if (UserElement.classList.contains('blocked'))
					return 'blocked';
			}
			return 'offline'; // Default to offline if status not found or user is offline
		}
	}

	window.chatApp = new ChatApp();
}