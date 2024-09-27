if (typeof ChatApp === 'undefined') {
	class ChatApp {
		constructor() {
			this.chatSocket = null;
			this.messageQueue = [];
			this.reconnectAttempts = 0;
			this.maxReconnectAttempts = 5;
			this.unreadMessageCount = 0;
			this.chatModalOpen = false;
			this.messageHistory = document.getElementById('message-history');
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
				console.log('WebSocket connection established');
				this.reconnectAttempts = 0;
				this.processMessageQueue();
			};
		}

		setupChatModalListeners() {
			const chatCanvas = document.getElementById('chatCanvas');
			if (chatCanvas) {
				chatCanvas.addEventListener('show.bs.offcanvas', () => {
					this.chatModalOpen = true;
					this.resetUnreadMessageCount();
				});
				chatCanvas.addEventListener('hide.bs.offcanvas', () => {
					this.chatModalOpen = false;
				});
			}
		}

		handleMessage(e) {
			const data = JSON.parse(e.data);
			console.log("Received data:", data);
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
			console.log('WebSocket closed. Code:', e.code, 'Reason:', e.reason);
			if (this.reconnectAttempts < this.maxReconnectAttempts) {
				const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
				console.log(`Reconnect attempt ${this.reconnectAttempts + 1} will be made in ${delay}ms`);
				setTimeout(() => {
					this.reconnectAttempts++;
					this.createWebSocketConnection();
				}, delay);
			} else {
				console.error('Max reconnect attempts reached. Please refresh the page.');
			}
		}

		handleError(err) {
			console.error('WebSocket error:', err);
			// You might want to display an error message to the user here
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
			console.log("Sending message to:", recipientId);
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
					this.messageHistory.innerHTML = '';
					this.messageCountByUser[userId] = data.length;
					console.log("Message history loaded:", data);
					data.forEach(message => {
						try {
							this.addMessage(message.content, message.sender_id, new Date(message.timestamp));
						} catch (error) {
							console.error('Error adding message:', error);
						}
					});
					this.messageHistory.scrollTop = this.messageHistory.scrollHeight;
					this.updateChatHeading(userId);
				})
				.catch(error => {
					console.error('Error loading message history:', error);
				});
		}

		updateChatHeading(userId) {
			const chatHeading = document.getElementById('chatHeading');
			const unreadBadge = document.getElementById('unreadBadge');
			const messageCount = this.messageCountByUser[userId] || 0;
			const userName = document.querySelector(`.user-chat[data-user-id="${userId}"]`).textContent.trim();
			chatHeading.textContent = `Chat with ${userName}`;
			unreadBadge.textContent = messageCount;

			const visuallyHiddenElement = unreadBadge.querySelector('.visually-hidden');
			if (visuallyHiddenElement) {
				visuallyHiddenElement.textContent = `${messageCount} messages`;
			} else {
				const span = document.createElement('span');
				span.className = 'visually-hidden';
				span.textContent = `${messageCount} messages`;
				unreadBadge.appendChild(span);
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
					if (response.ok) {
						return response.json();
					}
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
					console.error('Error:', error);
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
				console.log('WebSocket not connected. Queueing message.');
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
			console.log("Updating user status:", userId, status);
			const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
			if (userElement) {
				const statusIcon = userElement.querySelector('.status-icon');
				if (status === 'online') {
					statusIcon.innerHTML = '&#x1F7E2;'; // Green circle
					userElement.classList.add('online');
					userElement.classList.remove('offline');
				} else if (status === 'offline') {
					statusIcon.innerHTML = '&#x26AA;'; // White circle
					userElement.classList.add('offline');
					userElement.classList.remove('online');
				} else if (status === 'blocked') {
					statusIcon.innerHTML = '&#x1F534;'; // Red circle
					userElement.classList.add('blocked');
					userElement.classList.remove('online', 'offline');
				}
			}
		}

		addMessage(message, senderId, timestamp = null) {
			console.log('addMessage called with:', { message, senderId, timestamp });
			senderId = parseInt(senderId, 10);

			const messageElement = document.createElement('div');
			messageElement.classList.add('chat-bubble');

			if (!this.currentUserId) {
				console.error('Current user ID is not set. Unable to determine message sender.');
				return;
			}

			messageElement.classList.add(senderId === this.currentUserId ? 'sent' : 'received');

			let senderName = 'Unknown User';
			if (senderId === this.currentUserId) {
				senderName = 'You';
				console.log('Message is from current user');
			} else {
				const userElement = document.querySelector(`.user-chat[data-user-id="${senderId}"]`);
				if (userElement) {
					senderName = userElement.textContent.trim();
					console.log('Found user element:', userElement);
				} else {
					console.log('User element not found for ID:', senderId);
				}
			}
			console.log('Sender name determined:', senderName);

			let formattedTimestamp = 'Just now';
			if (timestamp) {
				console.log('Timestamp provided:', timestamp);
				const date = new Date(timestamp);
				if (!isNaN(date.getTime())) {
					formattedTimestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
					console.log('Formatted timestamp:', formattedTimestamp);
				} else {
					console.log('Invalid timestamp provided');
				}
			} else {
				console.log('No timestamp provided, using current time');
				formattedTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			}

			messageElement.innerHTML = `
				<p>${message}</p>
				<small>${formattedTimestamp} - ${senderName}</small>
			`;
			console.log('Message element created:', messageElement.outerHTML);

			this.messageHistory.appendChild(messageElement);
			this.messageHistory.scrollTop = this.messageHistory.scrollHeight;

			if (senderId === this.selectedUserId || senderId === this.currentUserId) {
				this.messageCountByUser[this.selectedUserId] = (this.messageCountByUser[this.selectedUserId] || 0) + 1;
				this.updateChatHeading(this.selectedUserId);
			}
		}

		handleGameInvitation(gameId, senderId) {
			if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`)) {
				window.location.href = `/games/${gameId}/?opponent=${senderId}`;
			}
		}

		handleTournamentWarning(tournamentId, matchTime) {
			alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
		}

		displayUserProfile(profile) {
			const existingProfileModal = document.querySelector('.profile-modal');
			if (existingProfileModal) {
				document.body.removeChild(existingProfileModal);
			}

			const profileModal = document.createElement('div');
			profileModal.classList.add('profile-modal');
			profileModal.innerHTML = `
				<h2>${profile.username}'s Profile</h2>
				<p>Email: ${profile.email}</p>
				<p>Bio: ${profile.bio}</p>
				<img src="${profile.profile_picture}" alt="Profile Picture"> <!-- Display profile picture if available -->
			`;
			document.body.appendChild(profileModal);

			profileModal.addEventListener('click', function () {
				document.body.removeChild(profileModal);
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
			const chatIcon = document.querySelector('.chat-icon i');
			const chatBadge = document.querySelector('.chat-badge');

			if (chatIcon && chatBadge) {
				if (this.unreadMessageCount > 0) {
					chatIcon.classList.remove('text-secondary');
					chatIcon.classList.add('text-primary');
					chatBadge.textContent = this.unreadMessageCount > 99 ? '99+' : this.unreadMessageCount;
					chatBadge.style.display = 'inline';
				} else {
					chatIcon.classList.remove('text-primary');
					chatIcon.classList.add('text-secondary');
					chatBadge.style.display = 'none';
				}
			}
		}

		getCurrentUserId() {
			const userId = document.body.dataset.userId;
			if (!userId) {
				console.error('User ID not found in body dataset. Make sure to set data-user-id on the body element.');
				return null;
			}
			return parseInt(userId, 10);
		}
	}

	window.chatApp = new ChatApp();
}