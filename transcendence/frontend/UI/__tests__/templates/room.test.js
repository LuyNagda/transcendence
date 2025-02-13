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
			'game_settings': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/components/game_settings.html'), 'utf8'),
			'mode_selection': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/components/mode_selection.html'), 'utf8'),
			'game': fs.readFileSync(path.join(TEMPLATES_DIR, 'pong/components/game.html'), 'utf8')
		};

		// Register all templates at once to handle includes
		factory.registerTemplates(templates);
	});

	afterEach(() => {
		factory.cleanup();
	});

	describe('Room State Component', () => {
		beforeEach(() => {
			factory.loadTemplate('room_state', 'room', { isRegistered: true });
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

			const roomData = factory.getData('room');

			// For now, let's verify the data is correctly registered
			expect(roomData.players[0].username).toBe('Player1');
			expect(roomData.players[1].username).toBe('Player2');
			expect(roomData.mode).toBe('CLASSIC');

			expect(factory.exists('#startGameBtn')).toBeTruthy();
			expect(factory.query('.card-subtitle').textContent).toContain('Mode: CLASSIC');
		});

		test('shows player badges correctly', () => {
			factory.loadTemplate('room_state', 'room', { isRegistered: true });

			// Register the data with computed properties like in RoomUIManager
			factory.registerData('room', {
				mode: 'CLASSIC',
				players: [
					{ id: 1, username: 'Player1' }
				],
				maxPlayers: 2,
				owner: { id: 1 },
				currentUser: { id: 1 },
				state: 'LOBBY',
				// Include computed properties as functions in the data object
				mappedPlayers: function () {
					const players = this.players || [];
					const currentUserId = this.currentUser?.id;
					return players.map(player => ({
						...player,
						isCurrentUser: player.id === currentUserId,
						isOwner: player.id === this.owner?.id,
						canBeKicked: player.id !== this.owner?.id && this.owner?.id === currentUserId
					}));
				},
				isOwner: function () {
					return this.owner?.id === this.currentUser?.id;
				},
				isLobbyState: function () {
					return this.state === 'LOBBY';
				}
			});

			factory.updateAll();

			// Check that the player list is rendered first
			const playerList = factory.query('.list-group');
			expect(playerList).toBeTruthy();

			// Check that the player item exists and contains the username
			const playerItem = factory.query('.list-group-item');
			expect(playerItem).toBeTruthy();
			expect(playerItem.textContent).toContain('Player1');

			// Check badges - now they should exist because mappedPlayers adds the properties
			const ownerBadges = factory.getTextContent('.badge.bg-info');
			const currentUserBadges = factory.getTextContent('.badge.bg-primary');
			expect(ownerBadges[0]).toBe('Owner');
			expect(currentUserBadges[0]).toBe('You');
		});

		test('displays pending invitations', () => {
			// Load the template first
			factory.loadTemplate('room_state', 'room', { isRegistered: true });

			// Register the data with the correct structure
			factory.registerData('room', {
				mode: 'CLASSIC',
				players: [
					{ id: 1, username: 'Player1', isOwner: true, isCurrentUser: true }
				],
				maxPlayers: 2,
				isOwner: true,
				isLobbyState: true,
				startGameInProgress: false,
				pendingInvitations: [
					{ id: 3, username: 'InvitedPlayer' }
				],
				owner: { id: 1 },
				currentUser: { id: 1 }
			});

			// Register computed properties
			factory.jaiPasVu.registerComputed('room', {
				mappedPlayers: (state) => {
					return state.players.map(player => ({
						...player,
						isCurrentUser: player.id === state.currentUser?.id,
						isOwner: player.id === state.owner?.id,
						canBeKicked: player.id !== state.owner?.id && state.owner?.id === state.currentUser?.id
					}));
				}
			});

			factory.updateAll();

			// Check that the pending invitations section exists
			const pendingSection = factory.query('div[aria-live="polite"] h6');
			expect(pendingSection).toBeTruthy();
			expect(pendingSection.textContent).toBe('Pending Invitations');
			expect(factory.exists('.badge.bg-warning')).toBeTruthy();

			// Check that the list item for the invitation exists with correct binding
			const invitationSpan = factory.query('.list-group-item > span[v-text="invitation.username"]');
			expect(invitationSpan).toBeTruthy();
		});
	});

	describe('Game Settings Component', () => {
		beforeEach(() => {
			factory.loadTemplate('game_settings', 'room', { isRegistered: true });
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
				currentUser: { id: 2 },
				mode: 'CLASSIC',
				state: 'PLAYING'
			});

			// Register computed properties to match RoomUIManager
			factory.jaiPasVu.registerComputed('room', {
				isOwner: (state) => state.owner?.id === state.currentUser?.id,
				isLobbyState: (state) => state.state === 'LOBBY'
			});

			factory.updateAll();

			expect(factory.isVisible('#settings-form')).toBeFalsy();
			const progressBars = factory.queryAll('.progress-bar');
			expect(progressBars.length).toBe(3); // paddleSpeed, ballSpeed, paddleSize
			expect(progressBars[0].textContent).toContain('5/10');
			expect(progressBars[1].textContent).toContain('7/10');
			expect(progressBars[2].textContent).toContain('4/10');
		});
	});

	describe('Full Pong Room Integration', () => {
		beforeEach(() => {
			factory.loadTemplate('pong_room', 'room', { isRegistered: true });
		});

		test('integrates all components correctly', () => {
			// Register the data with computed properties
			factory.registerData('room', {
				state: 'LOBBY',
				mode: 'CLASSIC',
				settings: {
					paddleSpeed: 5,
					ballSpeed: 7,
					paddleSize: 4,
					maxScore: 11
				},
				players: [
					{ id: 1, username: 'Player1' }
				],
				maxPlayers: 2,
				owner: { id: 1 },
				currentUser: { id: 1 },
				pendingInvitations: [],
				// Include computed properties as functions in the data object
				mappedPlayers: function () {
					const players = this.players || [];
					const currentUserId = this.currentUser?.id;
					return players.map(player => ({
						...player,
						isCurrentUser: player.id === currentUserId,
						isOwner: player.id === this.owner?.id,
						canBeKicked: player.id !== this.owner?.id && this.owner?.id === currentUserId
					}));
				},
				isOwner: function () {
					return this.owner?.id === this.currentUser?.id;
				},
				isLobbyState: function () {
					return this.state === 'LOBBY';
				}
			});

			// Force a reactive update
			factory.updateAll();

			// Check room state
			expect(factory.query('#room-state')).toBeTruthy();
			expect(factory.query('#room-state-description').textContent).toContain('CLASSIC');

			// Check player list rendering
			const playerListItem = factory.query('.list-group-item');
			expect(playerListItem).toBeTruthy();

			// Check player username is rendered
			const usernameSpan = factory.getTextContent('.list-group-item > span')[0];
			expect(usernameSpan).toBe('Player1');

			// Check badges
			const ownerBadge = factory.getTextContent('.badge.bg-info')[0];
			const currentUserBadge = factory.getTextContent('.badge.bg-primary')[0];
			expect(ownerBadge).toBe('Owner');
			expect(currentUserBadge).toBe('You');

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
				state: 'LOBBY',
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

			// Register computed properties
			factory.jaiPasVu.registerComputed('room', {
				mappedPlayers: (state) => {
					return state.players.map(player => ({
						...player,
						isCurrentUser: player.id === state.currentUser?.id,
						isOwner: player.id === state.owner?.id,
						canBeKicked: player.id !== state.owner?.id && state.owner?.id === state.currentUser?.id
					}));
				},
				isOwner: (state) => state.owner?.id === state.currentUser?.id,
				isLobbyState: (state) => state.state === 'LOBBY'
			});

			factory.updateAll();
			expect(factory.exists('#mode-selection-container')).toBeTruthy();

			// Transition to game started
			factory.registerData('room', {
				state: 'PLAYING',
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
				gameStarted: true,
				owner: { id: 1 },
				currentUser: { id: 2 },  // Make current user different from owner
				pendingInvitations: []
			});

			factory.updateAll();

			expect(factory.isVisible('#mode-selection-container')).toBeFalsy();
			expect(factory.isVisible('#settings-form')).toBeFalsy();
			expect(factory.exists('.progress-bar')).toBeTruthy();
		});
	});
});
