import { store } from '../state/store.js';
import { Offcanvas } from '../vendor.js';
import logger from '../logger.js';

export default class UIHandler {
	constructor(chatApp) {
		this.chatApp = chatApp;
		this._initializeUIElements();
		this._initializeCanvas();
		this._attachEventListeners();
	}

	_initializeUIElements() {
		this.messageHistory = document.getElementById('message-history');
		this.chatForm = document.querySelector('#chat-form');
		this.chatHeading = document.getElementById('chatHeading');
		this.unreadBadge = document.getElementById('unreadBadge');
		const navLink = document.querySelector('.nav-link[data-bs-target="#chatCanvas"]');

		this.chatIcon = navLink?.querySelector('svg');
		this.chatBadge = navLink?.querySelector('.chat-badge');
		this.userList = document.querySelector('.user-list ul');
	}

	_initializeCanvas() {
		this.chatCanvas = document.getElementById('chatCanvas');

		if (this.chatCanvas) {
			// Initialize Bootstrap Offcanvas
			this.offcanvasInstance = new Offcanvas(this.chatCanvas);

			this.chatCanvas.addEventListener('show.bs.offcanvas', () => {
				logger.debug('Chat offcanvas showing');
				this.chatApp.setChatModalOpen(true);
			});

			this.chatCanvas.addEventListener('hide.bs.offcanvas', () => {
				logger.debug('Chat offcanvas hiding');
				this.chatApp.setChatModalOpen(false);
			});

			logger.debug('Chat canvas initialized successfully');
		} else {
			logger.error('Chat canvas element not found');
		}
	}

	_attachEventListeners() {
		if (this.chatForm) {
			this.chatForm.addEventListener('submit', (e) => {
				e.preventDefault();
				this.chatApp.handleFormSubmit(e);
			});
		}

		if (this.chatCanvas) {
			this.chatCanvas.addEventListener('shown.bs.offcanvas', () => {
				this.chatApp.setChatModalOpen(true);
			});

			this.chatCanvas.addEventListener('hidden.bs.offcanvas', () => {
				this.chatApp.setChatModalOpen(false);
			});
		}

		this._attachUserListEventListeners();
		this._attachActionButtonListeners();
	}

	_attachUserListEventListeners() {
		if (!this.userList) {
			logger.warn('User list element not found');
			return;
		}

		this.userList.addEventListener('click', (event) => {
			const userItem = event.target.closest('[data-user-id]');
			if (userItem) {
				const userId = Number(userItem.dataset.userId);
				this.chatApp.handleUserClick(event);
			}
		});
	}

	updateUserList(users) {
		if (!this.userList) return;

		const chatState = store.getState('chat');
		const currentUserId = store.getState('user').id;

		this.userList.innerHTML = users.map(user => {
			const isBlocked = user.blocked || false;
			return `
				<li>
					<div class="d-flex flex-column">
						<button href="#" 
							class="btn btn-transparent btn-sm me-1 mt-1 mb-1 d-flex justify-content-start align-items-center user-chat ${user.id === chatState.activeRoom ? 'active' : ''} ${isBlocked ? 'blocked' : ''}" 
							data-user-id="${user.id}">
							<img src="${user.profile_picture}" class="rounded-circle" style="max-width: 20px;" 
								alt="${user.name || user.username}'s profile picture">
							<span class="user-name ms-2">${user.name || user.username}</span>
							<span class="status-icon ms-2">
								${isBlocked ? '&#x1F534;' : (user.online ? '&#x1F7E2;' : '&#x26AA;')}
							</span>
						</button>
					</div>
				</li>
			`;
		}).join('');

		if (chatState.activeRoom) {
			const activeUser = users.find(user => user.id === chatState.activeRoom);
			if (activeUser && activeUser.blocked) {
				const chatInput = document.querySelector('#chat-message');
				const sendButton = document.querySelector('#button-addon2');
				if (chatInput && sendButton) {
					chatInput.disabled = true;
					chatInput.placeholder = "This user has blocked you";
					sendButton.disabled = true;
				}
			}
		}

		this._attachUserListEventListeners();
		this._attachActionButtonListeners();
	}

	_attachActionButtonListeners() {
		document.querySelectorAll('.invite-pong, .view-profile, .block-user, .unblock-user').forEach(element => {
			const clone = element.cloneNode(true);
			element.parentNode.replaceChild(clone, element);
		});

		document.querySelectorAll('.invite-pong, .view-profile, .block-user, .unblock-user').forEach(element => {
			element.addEventListener('click', (e) => this.chatApp.handleSpecialActions(e));
		});
	}

	updateMessages(messages) {
		if (!this.messageHistory) return;

		this.messageHistory.innerHTML = '';
		messages.forEach(message => {
			const currentUserId = store.getState('user').id;
			const isSent = Number(message.sender) === currentUserId;
			this.addMessageToUI(message, isSent);
		});
		this.messageHistory.scrollTop = this.messageHistory.scrollHeight;
	}

	addMessageToUI(message, isSent) {
		const messageElement = document.createElement('div');
		messageElement.classList.add('chat-bubble', isSent ? 'sent' : 'received');
		messageElement.setAttribute('data-user-id', Number(message.sender));

		const senderName = isSent ? 'You' : this.getUserName(Number(message.sender));
		const formattedTimestamp = new Date(message.timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});

		messageElement.innerHTML = `
			<div class="message-header">
				<span class="sender-name">${senderName}</span>
			</div>
			<p>${message.content}</p>
			<small>${formattedTimestamp}</small>
		`;

		this.messageHistory.appendChild(messageElement);
	}

	getUserName(userId) {
		userId = Number(userId);
		if (userId === store.getState('user').id) {
			return 'You';
		}
		const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
		return userElement ? userElement.querySelector('.user-name').textContent.trim() : 'Unknown User';
	}

	getStatusIconHTML(userId) {
		const userElement = document.querySelector(`.user-chat[data-user-id="${Number(userId)}"]`);
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
		logger.debug('Updating unread count:', {
			count,
			chatIconExists: !!this.chatIcon,
			chatBadgeExists: !!this.chatBadge,
			chatIconHTML: this.chatIcon?.outerHTML,
			chatBadgeHTML: this.chatBadge?.outerHTML
		});

		const totalCount = count > 99 ? '99+' : count;

		// Update chat icon and badge in navbar
		if (this.chatIcon && this.chatBadge) {
			if (count > 0) {
				logger.debug('Setting active state for count > 0');

				// Update icon color
				this.chatIcon.setAttribute('fill', 'var(--bs-primary)');

				// Show and update badge
				this.chatBadge.style.removeProperty('display');

				// Update badge text while preserving visually hidden span
				const visiblyHidden = this.chatBadge.querySelector('.visually-hidden');
				this.chatBadge.textContent = totalCount;
				if (visiblyHidden) {
					this.chatBadge.appendChild(visiblyHidden);
				}

				logger.debug('After update (count > 0):', {
					badgeDisplay: this.chatBadge.style.display,
					badgeText: this.chatBadge.textContent,
					badgeHTML: this.chatBadge.outerHTML,
					iconColor: this.chatIcon.getAttribute('fill')
				});
			} else {
				logger.debug('Setting inactive state for count = 0');

				// Reset icon color
				this.chatIcon.setAttribute('fill', 'currentColor');

				// Hide badge
				this.chatBadge.style.display = 'none';

				// Update badge text while preserving visually hidden span
				const visiblyHidden = this.chatBadge.querySelector('.visually-hidden');
				this.chatBadge.textContent = '0';
				if (visiblyHidden) {
					this.chatBadge.appendChild(visiblyHidden);
				}

				logger.debug('After update (count = 0):', {
					badgeDisplay: this.chatBadge.style.display,
					badgeText: this.chatBadge.textContent,
					badgeHTML: this.chatBadge.outerHTML,
					iconColor: this.chatIcon.getAttribute('fill')
				});
			}
		} else {
			logger.warn('Chat icon or badge not found:', {
				chatIconExists: !!this.chatIcon,
				chatBadgeExists: !!this.chatBadge
			});
		}

		// Update unread badge in chat canvas
		if (this.unreadBadge) {
			this.unreadBadge.textContent = totalCount;
			this.unreadBadge.style.display = count > 0 ? 'inline' : 'none';

			let visuallyHidden = this.unreadBadge.querySelector('.visually-hidden');
			if (!visuallyHidden) {
				visuallyHidden = document.createElement('span');
				visuallyHidden.className = 'visually-hidden';
				this.unreadBadge.appendChild(visuallyHidden);
			}
			visuallyHidden.textContent = `${count} unread messages`;

			logger.debug('Updated chat canvas badge:', {
				badgeDisplay: this.unreadBadge.style.display,
				badgeText: this.unreadBadge.textContent,
				badgeHTML: this.unreadBadge.outerHTML
			});
		} else {
			logger.warn('Chat canvas unread badge not found');
		}
	}

	displayProfileModal(profile) {
		const existingModal = document.getElementById('profileModal');
		if (existingModal) {
			existingModal.remove();
		}

		const modal = document.createElement('div');
		modal.id = 'profileModal';
		modal.className = 'modal fade show';
		modal.setAttribute('tabindex', '-1');
		modal.setAttribute('aria-hidden', 'true');
		modal.style.display = 'block';
		modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

		modal.innerHTML = `
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">${profile.username}'s Profile</h5>
						<button type="button" class="btn-close" onclick="this.closest('#profileModal').remove()"></button>
					</div>
					<div class="modal-body">
						<div class="text-center mb-3">
							<img src="${profile.profile_picture}" 
								alt="Profile Picture" 
								class="rounded-circle img-thumbnail"
								style="width: 150px; height: 150px; object-fit: cover;">
						</div>
						<div class="profile-info">
							<div class="mb-2">
								<strong>Username:</strong> ${profile.username}
							</div>
							${profile.name ? `<div class="mb-2"><strong>Name:</strong> ${profile.name}</div>` : ''}
							${profile.nick_name ? `<div class="mb-2"><strong>Nickname:</strong> ${profile.nick_name}</div>` : ''}
							<div class="mb-2">
								<strong>Email:</strong> ${profile.email}
							</div>
							<div class="mb-2">
								<strong>Bio:</strong> ${profile.bio || 'No bio provided'}
							</div>
							<div class="mb-2">
								<strong>Status:</strong> 
								<span class="badge ${profile.online ? 'bg-success' : 'bg-secondary'}">
									${profile.online ? 'Online' : 'Offline'}
								</span>
							</div>
						</div>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" onclick="this.closest('#profileModal').remove()">Close</button>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(modal);

		// Close modal when clicking outside
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				modal.remove();
			}
		});

		// Close modal when pressing ESC key
		document.addEventListener('keydown', function closeOnEscape(e) {
			if (e.key === 'Escape') {
				modal.remove();
				document.removeEventListener('keydown', closeOnEscape);
			}
		});
	}
}