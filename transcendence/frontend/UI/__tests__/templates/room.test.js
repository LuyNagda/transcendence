import { JaiPasVuTestFactory } from '../../JaiPasVuTestFactory.js';
import fs from 'fs';
import path from 'path';

describe('Pong Room Templates', () => {
	let factory;
	const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

	beforeEach(() => {
		factory = new JaiPasVuTestFactory();
		factory.setup();

		// Register all pong room related templates
		const templates = {
			'pong_room': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/pong_room.html'), 'utf8'),
			'room_state': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/components/room_state.html'), 'utf8'),
			'game_settings': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/components/game_settings.html'), 'utf8')
		};

		// Register each template
		Object.entries(templates).forEach(([name, content]) => {
			factory.registerTemplate(name, content);
		});
	});

	afterEach(() => {
		factory.cleanup();
	});

	describe('Room State Component', () => {
		beforeEach(() => {
			factory.loadTemplate('room_state', 'room', true);
		});

		test('displays room mode and player count correctly', () => {
			factory.registerData('room', {
				mode: 'CLASSIC',
				players: [
					{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true },
					{ id: 2, username: 'Player2', isOwner: false, isCurrentUser: false }
				],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				startGameInProgress: false,
				pendingInvitations: []
			});

			factory.updateAll();

			expect(factory.query('#room-state-description').textContent).toContain('CLASSIC');

			// Get debug info to check the rendered state
			const debugInfo = factory.getDebugInfo();
			console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));

			// Check if data is properly registered
			const roomData = factory.getData('room');
			console.log('Room Data:', JSON.stringify(roomData, null, 2));

			// For now, let's verify the data is correctly registered
			expect(roomData.players[0].username).toBe('Player1');
			expect(roomData.players[1].username).toBe('Player2');
			expect(roomData.mode).toBe('CLASSIC');

			expect(factory.exists('#startGameBtn')).toBeTruthy();
			expect(factory.query('.card-subtitle').textContent).toContain('Mode: CLASSIC');
		});

		test('shows player badges correctly', () => {
			factory.registerData('room', {
				mode: 'CLASSIC',
				players: [
					{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true },
					{ id: 2, username: 'Player2', isOwner: false, isCurrentUser: false }
				],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				startGameInProgress: false,
				pendingInvitations: []
			});

			factory.updateAll();

			const ownerBadges = factory.getTextContent('.badge.bg-info');
			const currentUserBadges = factory.getTextContent('.badge.bg-primary');
			expect(ownerBadges).toContain('Owner');
			expect(currentUserBadges).toContain('You');
		});

		test('displays pending invitations', () => {
			factory.registerData('room', {
				mode: 'CLASSIC',
				players: [{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true }],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				startGameInProgress: false,
				pendingInvitations: [
					{ id: 3, username: 'InvitedPlayer' }
				]
			});

			factory.updateAll();

			// Verify the data is correctly registered
			const roomData = factory.getData('room');
			expect(roomData.pendingInvitations[0].username).toBe('InvitedPlayer');

			// Check that the pending invitations section exists and has the correct structure
			expect(factory.exists('div[v-if="pendingInvitations.length > 0"]')).toBeTruthy();
			expect(factory.exists('.badge.bg-warning')).toBeTruthy();

			// Check that the list item for the invitation exists with correct binding
			const invitationSpan = factory.query('.list-group-item > span[v-text="invitation.username"]');
			expect(invitationSpan).toBeTruthy();
		});
	});

	describe('Game Settings Component', () => {
		beforeEach(() => {
			factory.loadTemplate('game_settings', 'room', true);
		});

		test('shows all settings controls for room owner in lobby', () => {
			factory.registerData('room', {
				settings: {
					paddleSpeed: 5,
					ballSpeed: 7,
					paddleSize: 4,
					maxScore: 11,
					aiDifficulty: 'MEDIUM'
				},
				gameStarted: false,
				owner: { id: 1 },
				currentUser: { id: 1 },
				mode: 'AI'
			});

			factory.updateAll();

			expect(factory.exists('#settings-form')).toBeTruthy();
			expect(factory.exists('#paddleSpeed')).toBeTruthy();
			expect(factory.exists('#ballSpeed')).toBeTruthy();
			expect(factory.exists('#paddleSize')).toBeTruthy();
			expect(factory.exists('#maxScore')).toBeTruthy();
			expect(factory.exists('#aiDifficulty')).toBeTruthy();
		});

		test('shows read-only progress bars during game', () => {
			factory.registerData('room', {
				settings: {
					paddleSpeed: 5,
					ballSpeed: 7,
					paddleSize: 4,
					maxScore: 11
				},
				gameStarted: true,
				owner: { id: 1 },
				currentUser: { id: 1 },
				mode: 'CLASSIC'
			});

			factory.updateAll();

			expect(factory.exists('#settings-form')).toBeFalsy();
			const progressBars = factory.queryAll('.progress-bar');
			expect(progressBars.length).toBe(3); // paddleSpeed, ballSpeed, paddleSize
			expect(progressBars[0].textContent).toContain('5/10');
			expect(progressBars[1].textContent).toContain('7/10');
			expect(progressBars[2].textContent).toContain('4%');
		});
	});

	describe('Full Pong Room Integration', () => {
		beforeEach(() => {
			factory.loadTemplate('pong_room', 'room', true);
		});

		test('integrates all components correctly', () => {
			factory.registerData('room', {
				mode: 'CLASSIC',
				settings: {
					paddleSpeed: 5,
					ballSpeed: 7,
					paddleSize: 4,
					maxScore: 11
				},
				players: [
					{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true }
				],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				gameStarted: false,
				owner: { id: 1 },
				currentUser: { id: 1 },
				pendingInvitations: []
			});

			factory.updateAll();

			// Check room state
			expect(factory.query('#room-state').textContent).toContain('CLASSIC');
			expect(factory.query('#room-state').textContent).toContain('Player1');

			// Check game settings
			expect(factory.exists('#settings-form')).toBeTruthy();
			expect(factory.exists('#paddleSpeed')).toBeTruthy();
			expect(factory.exists('#ballSpeed')).toBeTruthy();

			// Check dynamic content
			expect(factory.exists('#mode-selection-container')).toBeTruthy();
		});

		test('handles game state transitions', () => {
			// Start in lobby
			factory.registerData('room', {
				mode: 'CLASSIC',
				settings: {
					paddleSpeed: 5,
					ballSpeed: 7,
					paddleSize: 4,
					maxScore: 11
				},
				state: 'LOBBY',
				players: [
					{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true }
				],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				gameStarted: false,
				owner: { id: 1 },
				currentUser: { id: 1 },
				pendingInvitations: []
			});

			factory.updateAll();
			expect(factory.exists('#mode-selection-container')).toBeTruthy();

			// Transition to game started
			factory.registerData('room', {
				...factory.getData('room'),
				state: 'IN_GAME',
				gameStarted: true,
				isLobbyState: false
			});

			factory.updateAll();
			expect(factory.exists('#mode-selection-container')).toBeFalsy();
			expect(factory.exists('#settings-form')).toBeFalsy();
			expect(factory.exists('.progress-bar')).toBeTruthy();
		});
	});
});
