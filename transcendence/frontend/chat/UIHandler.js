import Store from '../state/store.js';

export default class UIHandler {
	constructor(chatApp) {
		this.chatApp = chatApp;
		this._store = Store.getInstance();
		this.messageHistory = document.getElementById('message-history');
		this.chatForm = document.querySelector('#chat-form');
		this.chatCanvas = document.getElementById('ChatCanvas');
		this.chatHeading = document.getElementById('chatHeading');
		this.unreadBadge = document.getElementById('unreadBadge');
		this.chatIcon = document.querySelector('.chat-icon i');
		this.chatBadge = document.querySelector('.chat-badge');
		this.userList = document.querySelector('.user-list ul');
		this.attachEventListeners();
	}

	attachEventListeners() {
		if (this.chatForm) {
			this.chatForm.addEventListener('submit', (e) => this.chatApp.handleFormSubmit(e));
		}
		this.attachUserListEventListeners();
		document.querySelectorAll('.invite-pong, .view-profile').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleSpecialActions(e));
		});
		if (this.chatCanvas) {
			this.chatCanvas.addEventListener('show.bs.offcanvas', () => this.chatApp.setChatModalOpen(true));
			this.chatCanvas.addEventListener('hide.bs.offcanvas', () => this.chatApp.setChatModalOpen(false));
		}
	}

	attachUserListEventListeners() {
		document.querySelectorAll('.user-chat').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleUserClick(e));
		});
	}

	updateUserList(users) {
		if (!this.userList) return;

		const chatState = this._store.getState('chat');
		const currentUserId = this._store.getState('user').id;

		this.userList.innerHTML = users.map(user => `
			<li>
				<button href="#" 
					class="btn btn-transparent btn-sm me-1 user-chat ${user.id === chatState.activeRoom ? 'active' : ''}" 
					data-user-id="${user.id}">
					<img src="${user.profile_picture}" class="rounded-circle" style="max-width: 20px;" 
						alt="${user.name || user.username}'s profile picture">
					<span class="user-name">${user.name || user.username}</span>
					<span class="status-icon">
						${user.online ? '&#x1F7E2;' : '&#x26AA;'}
					</span>
				</button>
			</li>
		`).join('');

		this.attachUserListEventListeners();
	}

	updateMessages(messages) {
		if (!this.messageHistory) return;

		this.messageHistory.innerHTML = '';
		messages.forEach(message => {
			const currentUserId = this._store.getState('user').id;
			const isSent = message.sender === currentUserId;
			this.addMessageToUI(message, isSent);
		});
		this.messageHistory.scrollTop = this.messageHistory.scrollHeight;
	}

	addMessageToUI(message, isSent) {
		const messageElement = document.createElement('div');
		messageElement.classList.add('chat-bubble', isSent ? 'sent' : 'received');
		messageElement.setAttribute('data-user-id', message.sender);

		const senderName = isSent ? 'You' : this.getUserName(message.sender);
		const formattedTimestamp = new Date(message.timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});

		messageElement.innerHTML = `
			<div class="message-header">
				<span class="sender-name">${senderName}</span>
				${!isSent ? this.getStatusIconHTML(message.sender) : ''}
			</div>
			<p>${message.content}</p>
			<small>${formattedTimestamp}</small>
		`;

		this.messageHistory.appendChild(messageElement);
	}

	getUserName(userId) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		return userElement ? userElement.querySelector('.user-name').textContent.trim() : 'Unknown User';
	}

	getStatusIconHTML(userId) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		let status = 'offline';
		if (userElement) {
			if (userElement.classList.contains('online')) status = 'online';
			if (userElement.classList.contains('blocked')) status = 'blocked';
		}

		const icons = {
			online: '&#x1F7E2;',
			offline: '&#x26AA;',
			blocked: '&#x1F534;'
		};

		return `
			<span class="status-icon" aria-label="User status">
				${icons[status]}
			</span>
		`;
	}

	updateUnreadCount(count) {
		if (count > 0) {
			this.chatIcon.classList.remove('text-secondary');
			this.chatIcon.classList.add('text-primary');
			this.chatBadge.textContent = count > 99 ? '99+' : count;
			this.chatBadge.style.display = 'inline';
		} else {
			this.chatIcon.classList.remove('text-primary');
			this.chatIcon.classList.add('text-secondary');
			this.chatBadge.style.display = 'none';
		}

		if (this.unreadBadge) {
			this.unreadBadge.textContent = count;
			let visuallyHidden = this.unreadBadge.querySelector('.visually-hidden');
			if (!visuallyHidden) {
				visuallyHidden = document.createElement('span');
				visuallyHidden.className = 'visually-hidden';
				this.unreadBadge.appendChild(visuallyHidden);
			}
			visuallyHidden.textContent = `${count} messages`;
		}
	}

	displayProfileModal(profile) {
		const existingModal = document.querySelector('.profile-modal');
		if (existingModal) {
			document.body.removeChild(existingModal);
		}

		const modal = document.createElement('div');
		modal.classList.add('profile-modal');
		modal.innerHTML = `
			<h2>${profile.username}'s Profile</h2>
			<p>Email: ${profile.email}</p>
			<p>Bio: ${profile.bio}</p>
			<img src="${profile.profile_picture}" alt="Profile Picture">
		`;
		document.body.appendChild(modal);

		modal.addEventListener('click', () => {
			document.body.removeChild(modal);
		});
	}
}