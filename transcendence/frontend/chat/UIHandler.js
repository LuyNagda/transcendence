export default class UIHandler {
	constructor(chatApp) {
		this.chatApp = chatApp;
		this.messageHistory = document.getElementById('message-history');
		this.chatForm = document.querySelector('#chat-form');
		this.chatCanvas = document.getElementById('ChatCanvas');
		this.chatHeading = document.getElementById('chatHeading');
		this.unreadBadge = document.getElementById('unreadBadge');
		this.chatIcon = document.querySelector('.chat-icon i');
		this.chatBadge = document.querySelector('.chat-badge');
		this.attachEventListeners();
	}

	attachEventListeners() {
		if (this.chatForm) {
			this.chatForm.addEventListener('submit', (e) => this.chatApp.handleFormSubmit(e));
		}
		document.querySelectorAll('.user-chat').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleUserClick(e));
		});
		document.querySelectorAll('.block-user, .unblock-user').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleUserBlockToggle(e));
		});
		document.querySelectorAll('.invite-pong, .view-profile').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleSpecialActions(e));
		});
		if (this.chatCanvas) {
			this.chatCanvas.addEventListener('show.bs.offcanvas', () => this.chatApp.resetUnreadMessageCount());
			this.chatCanvas.addEventListener('hide.bs.offcanvas', () => this.chatApp.setChatModalOpen(false));
		}
	}

	updateChatIcon(unreadCount) {
		if (unreadCount > 0) {
			this.chatIcon.classList.remove('text-secondary');
			this.chatIcon.classList.add('text-primary');
			this.chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
			this.chatBadge.style.display = 'inline';
		} else {
			this.chatIcon.classList.remove('text-primary');
			this.chatIcon.classList.add('text-secondary');
			this.chatBadge.style.display = 'none';
		}
	}

	updateChatHeading(userName, messageCount) {
		this.chatHeading.textContent = `Chat with ${userName}`;
		this.unreadBadge.textContent = messageCount;

		let visuallyHidden = this.unreadBadge.querySelector('.visually-hidden');
		if (!visuallyHidden) {
			visuallyHidden = document.createElement('span');
			visuallyHidden.className = 'visually-hidden';
			this.unreadBadge.appendChild(visuallyHidden);
		}
		visuallyHidden.textContent = `${messageCount} messages`;
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