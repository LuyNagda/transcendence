import { jest } from '@jest/globals';
import { JaiPasVuTestFactory } from '../../JaiPasVuTestFactory.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { store } from '../../../state/store.js';
import { chatActions } from '../../../state/chatState.js';
import { USER_STATUS } from '../../../state/userState.js';

describe('Chat Template', () => {
	let factory;
	let template;
	const mockUsers = [
		{
			id: 1,
			username: 'testUser1',
			profile_picture: '/media/profile_pictures/user1.png',
			blocked: false,
			status: USER_STATUS.ONLINE,
			online: true,
			statusIcon: '🟢'
		},
		{
			id: 2,
			username: 'testUser2',
			profile_picture: '/media/profile_pictures/user2.png',
			blocked: true,
			status: USER_STATUS.OFFLINE,
			online: false,
			statusIcon: '🔴'
		}
	];

	const mockMessages = {
		1: [
			{
				id: 1,
				sender: 1,
				content: 'Hello!',
				timestamp: Date.now() - 1000,
				type: 'text'
			},
			{
				id: 2,
				sender: 3, // Current user
				content: 'Hi there!',
				timestamp: Date.now(),
				type: 'text'
			}
		]
	};

	beforeAll(() => {
		template = readFileSync(join(process.cwd(), 'templates', 'chat.html'), 'utf8');
	});

	beforeEach(() => {
		factory = new JaiPasVuTestFactory();
		factory.setup();

		store.dispatch({
			domain: 'user',
			type: 'SET_USER',
			payload: { id: 3, username: 'currentUser', status: USER_STATUS.ONLINE }
		});

		store.dispatch({
			domain: 'chat',
			type: chatActions.INITIALIZE,
			payload: {
				users: mockUsers,
				messages: mockMessages,
				selectedUser: null,
				unreadCounts: { 1: 2, 2: 1 },
				currentUserId: 3
			}
		});

		factory.registerTemplate('chat', template);
		factory.loadTemplate('chat', 'chat', { isRegistered: true });
		factory.registerData('chat', {
			users: mockUsers,
			messages: mockMessages[1] || [],
			unreadCount: 3,
			currentUserId: 3,
			selectedUser: null,
			getUserName: (id) => mockUsers.find(u => u.id === id)?.username || 'Unknown',
			formatTimestamp: (timestamp) => {
				const date = new Date(timestamp);
				return date.toLocaleTimeString();
			},
			handleFormSubmit: jest.fn(),
			selectUser: jest.fn(),
			blockUser: jest.fn(),
			unblockUser: jest.fn(),
			inviteToGame: jest.fn(),
			viewProfile: jest.fn()
		});
	});

	afterEach(() => {
		factory.cleanup();
		jest.clearAllMocks();
	});

	describe('Initial Rendering', () => {
		test('renders chat offcanvas with unread count', () => {
			const chatCanvas = factory.query('#chatCanvas');
			const unreadBadge = factory.query('#unreadBadge');
			expect(chatCanvas).toBeTruthy();
			expect(unreadBadge.textContent.trim()).toBe("3 Unread messages");
			expect(unreadBadge.style.display).not.toBe('none');
		});

		test('renders user list correctly', () => {
			const userElements = factory.queryAll('.user-list li');
			expect(userElements).toHaveLength(mockUsers.length);

			mockUsers.forEach((user, index) => {
				const userElement = userElements[index];
				expect(userElement.textContent.trim()).toContain(user.username);
				expect(userElement.querySelector('img').src)
					.toContain(user.profile_picture);
			});
		});

		test('displays correct status indicators', () => {
			const statusIcons = factory.queryAll('.status-icon');
			expect(statusIcons).toHaveLength(2);
			if (statusIcons.length > 0) {
				expect(statusIcons[0].textContent.trim()).toBe('🟢');
			}
			if (statusIcons.length > 1) {
				expect(statusIcons[1].textContent.trim()).toBe('🔴');
			}
		});
	});

	describe('User Interaction', () => {
		test('selecting a user loads their messages', () => {
			const firstUser = factory.query('.user-list li');
			firstUser.click();

			const messages = factory.queryAll('.message-content');
			expect(messages).toHaveLength(mockMessages[1].length);

			const messageContents = factory.getTextContent('.message-content');
			expect(messageContents).toContain('Hello!');
			expect(messageContents).toContain('Hi there!');
		});

		test('message form is disabled for blocked users', () => {
			const blockedUser = mockUsers.find(u => u.blocked);
			store.dispatch({
				domain: 'chat',
				type: chatActions.SET_SELECTED_USER,
				payload: blockedUser
			});

			const input = factory.query('#chat-message-input');
			const sendButton = factory.query('#message-send-button');

			expect(input.disabled).toBe(true);
			expect(sendButton.disabled).toBe(true);
			expect(input.placeholder).toBe('You have blocked this user');
		});

		test('can send message to unblocked user', () => {
			const unblockUser = mockUsers.find(u => !u.blocked);
			store.dispatch({
				domain: 'chat',
				type: chatActions.SET_SELECTED_USER,
				payload: unblockUser
			});
			factory.updateAll();

			const input = factory.query('#chat-message-input');

			input.value = 'Just sent test message';
			input.click();

			const messages = factory.queryAll('.message-content');
			const lastMessage = messages[messages.length - 1];
			expect(lastMessage.textContent.trim()).toBe('Just sent test message');
		});
	});

	describe('User Actions', () => {
		beforeEach(() => {
			factory.loadTemplate('chat', 'chat', { isRegistered: true });
			store.dispatch({
				domain: 'chat',
				type: chatActions.SET_SELECTED_USER,
				payload: mockUsers[0]
			});
		});

		test('can block user', () => {
			const blockButton = factory.query('#block-user-button');
			expect(blockButton.textContent.trim()).toBe('Block');

			blockButton.click();

			const updatedUser = store.getState('chat').users
				.find(u => u.id === mockUsers[0].id);
			expect(updatedUser.blocked).toBe(true);
		});

		test('can invite user to game', () => {
			const inviteButton = factory.query('#invite-to-game-button');
			expect(inviteButton.textContent.trim()).toBe('Invite');

			global.alert = jest.fn();
			inviteButton.click();

			expect(global.alert).toHaveBeenCalledWith('Game invitation sent!');
		});

		test('can view user profile', () => {
			const profileButton = factory.query('#view-profile-button');
			expect(profileButton.textContent.trim()).toBe('Profile');

			profileButton.click();
		});
	});

	describe('Message Display', () => {
		beforeEach(() => {
			factory.loadTemplate('chat', 'chat', { isRegistered: true });
			store.dispatch({
				domain: 'chat',
				type: chatActions.SET_SELECTED_USER,
				payload: mockUsers[0]
			});
		});

		test('messages are correctly styled based on sender', () => {
			// Ensure messages exist before testing
			const messages = factory.queryAll('.chat-bubble');
			expect(messages.length).toBeGreaterThanOrEqual(2);

			// Test message styling
			expect(messages.item(0).getAttribute('class').includes('received')).toBe(true);
			expect(messages.item(1).getAttribute('class').includes('sent')).toBe(true);
		});

		test('displays correct sender names', () => {
			// Ensure sender names exist before testing
			const senderNames = factory.queryAll('.sender-name');
			expect(senderNames.length).toBeGreaterThanOrEqual(2);

			// Test sender name display
			expect(senderNames[0].textContent.trim()).toBe('testUser1');
			expect(senderNames[1].textContent.trim()).toBe('You');
		});

		test('formats timestamps correctly', () => {
			const timestamps = factory.queryAll('.message-timestamp');
			timestamps.forEach(timestamp => {
				expect(timestamp.textContent.trim()).toMatch(/\d{1,2}:\d{2}:\d{2}/);
			});
		});
	});

	// describe('Accessibility', () => {
	// 	test('chat elements have proper ARIA labels', () => {
	// 		const chatButton = factory.query('[data-bs-toggle="offcanvas"]');
	// 		expect(chatButton.getAttribute('aria-controls')).toBe('chatCanvas');
	// 		expect(chatButton.getAttribute('aria-label')).toBe('Open chat');

	// 		const messageInput = factory.query('.message-input');
	// 		expect(messageInput.getAttribute('aria-label')).toBe('Message input');

	// 		const sendButton = factory.query('.send-button');
	// 		expect(sendButton.getAttribute('aria-label')).toBe('Send message');
	// 	});

	// 	test('status changes are announced to screen readers', () => {
	// 		const statusIndicators = factory.queryAll('.status-indicator');
	// 		statusIndicators.forEach(icon => {
	// 			expect(icon.getAttribute('aria-live')).toBe('polite');
	// 		});
	// 	});

	// 	test('unread count is properly announced', () => {
	// 		const unreadBadge = factory.query('#unreadBadge');
	// 		expect(unreadBadge.getAttribute('aria-live')).toBe('polite');
	// 		expect(unreadBadge.querySelector('.visually-hidden')).toBeTruthy();
	// 	});
	// });
}); 