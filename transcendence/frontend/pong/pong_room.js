import dynamicRender from "../utils/dynamic_render.js";
import logger from "../utils/logger.js";
import WSService from "../utils/WSService.js";
import { PongGame } from "./pong_game.js";

// Initialize dynamic render immediately
dynamicRender.initialize();

// Create a global PongRoom state manager
class PongRoomManager {
    constructor() {
        this.instance = null;
        logger.info("PongRoomManager initialized");
    }

    initialize(roomState) {
        logger.info("PongRoomManager.initialize called with state:", roomState);

        if (!this.instance) {
            logger.info("Creating new PongRoom instance");
            this.instance = new PongRoom(roomState.id, roomState.currentUser);
            logger.info("Adding PongRoom to observed objects");
            dynamicRender.addObservedObject('pongRoom', this.instance);
        }

        logger.info("Updating PongRoom state");
        this.instance.updateFromState(roomState);

        logger.info("Current observed objects:", {
            keys: Array.from(dynamicRender.observedObjects.keys()),
            pongRoomExists: dynamicRender.observedObjects.has('pongRoom')
        });

        this.instance.setStarted(false);
    }
}

// Create global instance
window.pongRoomManager = new PongRoomManager();

// HTMX initialization function
window.initializePongRoomData = function (roomState) {
    logger.info("initializePongRoomData called");
    if (!roomState || !roomState.roomId) {
        logger.error("Invalid room state:", roomState);
        return;
    }
    window.pongRoomManager.initialize(roomState);
};

// Add HTMX event listener for before content swap
document.body.addEventListener('htmx:beforeSwap', function (event) {
    logger.info("htmx:beforeSwap event fired");
    try {
        // Create a temporary div to parse the HTML string
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = event.detail.serverResponse;

        // Look for the room state data
        const roomStateScript = tempDiv.querySelector('#room-state-data');
        if (roomStateScript) {
            logger.info("Found room state script");
            const roomState = JSON.parse(roomStateScript.textContent.trim());
            logger.info("Parsed room state:", roomState);
            window.pongRoomManager.initialize(roomState);
        }
    } catch (error) {
        logger.error("Error processing beforeSwap:", error);
    }
});

export class PongRoom {
    constructor(roomId, currentUser) {
        if (!roomId) {
            const roomIdElement = document.getElementById('room-id');
            if (roomIdElement) {
                roomId = JSON.parse(roomIdElement.textContent);
            }
            if (!roomId) {
                throw new Error('Room ID is required');
            }
        }

        this._roomId = roomId;
        this._currentUser = currentUser;
        this._mode = 'CLASSIC';
        this._owner = {};
        this._players = [];
        this._pendingInvitations = [];
        this._maxPlayers = 0;
        this._state = "LOBBY";
        this._pongGame = null;
        this._useWebGL = false;

        this.initializeWebSocket();
        this.initializeEventListeners();
        logger.info(`PongRoom instance created for room ${roomId}`);
        this.logCurrentState();
    }

    initializeWebSocket() {
        this.wsService = new WSService();
        this.wsService.initializeConnection('pongRoom', `/ws/pong_room/${this._roomId}/`);

        this.wsService.on('pongRoom', 'onMessage', this.handleWebSocketMessage.bind(this));
        this.wsService.on('pongRoom', 'onClose', this.handleWebSocketClose.bind(this));
        this.wsService.on('pongRoom', 'onOpen', this.handleWebSocketOpen.bind(this));
        this.wsService.on('pongRoom', 'onError', this.handleWebSocketError.bind(this));
    }

    initializeEventListeners() {
        // Use event delegation to handle dynamically added buttons
        document.addEventListener('click', (event) => {
            if (event.target && event.target.id === 'startGameBtn') {
                this.startGame();
            }
        });
    }

    // Getters
    get roomId() { return this._roomId; }
    get mode() { return this._mode; }
    get owner() { return this._owner; }
    get players() { return this._players; }
    get pendingInvitations() { return this._pendingInvitations; }
    get maxPlayers() { return this._maxPlayers; }
    get availableSlots() { return this._maxPlayers - this._players.length - this._pendingInvitations.length; }
    get state() { return this._state; }
    get currentUser() { return this._currentUser; }
    get useWebGL() { return this._useWebGL; }

    updateMode(value) {
        if (this._mode !== value) {
            logger.info(`Setting mode from ${this._mode} to ${value}`);
            this._mode = value;
            this.notifyUpdate("mode", value);
            dynamicRender.scheduleUpdate();
        }
    }

    updateOwner(value) {
        if (this._owner.id !== value.id) {
            logger.info(`Setting owner from ${this._owner.username} to ${value.username}`);
            this._owner = value;
            this.notifyUpdate("owner", value);
            dynamicRender.scheduleUpdate();
        }
    }

    updatePlayers(value) {
        const currentIds = new Set(this._players.map(p => p.id));
        const newIds = new Set(value.map(p => p.id));
        if (currentIds.size !== newIds.size || ![...currentIds].every(id => newIds.has(id))) {
            logger.info(`Setting players from ${JSON.stringify(this._players)} to ${JSON.stringify(value)}`);
            this._players = value;
            this.notifyUpdate("players", value);
            dynamicRender.scheduleUpdate();
        }
    }

    updatePendingInvitations(value) {
        if (JSON.stringify(this._pendingInvitations) !== JSON.stringify(value)) {
            logger.info(`Setting pending invitations from ${JSON.stringify(this._pendingInvitations)} to ${JSON.stringify(value)}`);
            this._pendingInvitations = value;
            this.notifyUpdate("pending_invitations", value);
            dynamicRender.scheduleUpdate();
        }
    }

    updateMaxPlayers(value) {
        if (this._maxPlayers !== value) {
            logger.info(`Setting max players from ${this._maxPlayers} to ${value}`);
            this._maxPlayers = value;
            this.notifyUpdate("max_players", value);
            dynamicRender.scheduleUpdate();
        }
    }

    updateState(value) {
        if (this._state !== value) {
            logger.info(`Setting state from ${this._state} to ${value}`);
            this._state = value;
            this.notifyUpdate("state", value);
            dynamicRender.scheduleUpdate();
        }
    }

    // WebSocket event handlers
    handleWebSocketMessage(data) {
        logger.debug("WebSocket message received:", data);

        if (data.type === "room_update") {
            this.updateFromState(data.room_state);
        }
        else if (data.type === 'game_started') {
            this.handleGameStarted(data);
        }
    }

    async handleGameStarted(data) {
        logger.info("Game started event received", data);

        // Create new game instance with WebGL preference
        const isHost = this._currentUser.id === data.player1_id;
        this._pongGame = new PongGame(data.game_id, this._currentUser, isHost, this._useWebGL);

        // Add delay and retry logic for connection
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        while (retryCount < maxRetries) {
            try {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                await this._pongGame.connect();
                this.setStarted(true);
                break;
            } catch (error) {
                retryCount++;
                const shouldRetry = this.handleConnectionError(error.code);
                if (!shouldRetry || retryCount === maxRetries) {
                    logger.error("Max retry attempts reached for game connection");
                    this._pongGame = null;
                    this.updateState('LOBBY');
                    return;
                }
            }
        }

        // Update UI state
        this.setStarted(true);
        this.updateState('PLAYING');
        dynamicRender.scheduleUpdate();
        if (this._pongGame)
            this._pongGame.startGameLoop();
    }

    handleWebSocketClose(event) {
        logger.error("WebSocket closed unexpectedly", event);
        this._isInitialized = false;
    }

    handleWebSocketOpen(event) {
        logger.info("WebSocket connection established", event);
    }

    handleWebSocketError(event) {
        logger.error("WebSocket error:", event);
    }

    notifyUpdate(property, value) {
        this.sendMessage("update_property", { property, value });
    }

    sendMessage(action, data = {}) {
        const message = { action, ...data };
        logger.info(`Sending WebSocket message: ${JSON.stringify(message)}`);
        this.wsService.send('pongRoom', message);
    }

    // User actions
    changeMode(event) {
        const newMode = event.target.value;
        logger.debug('Setting mode from', this.mode, 'to', newMode);
        this.updateMode(newMode);
        this.sendMessage('update_property', { property: 'mode', value: newMode });
    }

    inviteFriend(friendId) {
        this.sendMessage("invite_friend", { friend_id: friendId });
    }

    cancelInvitation(invitationId) {
        this.sendMessage("cancel_invitation", { invitation_id: invitationId });
    }

    kickPlayer(playerId) {
        this.sendMessage("kick_player", { player_id: playerId });
    }

    async startGame() {
        try {
            this._useWebGL = document.getElementById('webgl-toggle')?.checked || false;
            this.sendMessage('start_game', { id: Date.now() });
            this.setLoading(true);
        } catch (error) {
            console.error('Error sending start game request:', error);
            this.setLoading(false);
        }
    }

    updateFromState(roomState) {
        logger.info("updateFromState called with:", roomState);
        let hasChanged = false;

        const logChange = (property, oldValue, newValue) => {
            logger.info(`Property ${property} changed:`, { old: oldValue, new: newValue });
        };

        // Check and update each property
        const updates = [
            { prop: '_mode', value: roomState.mode },
            { prop: '_owner', value: roomState.owner, compare: (a, b) => a.id === b.id },
            {
                prop: '_players', value: roomState.players, compare: (a, b) =>
                    JSON.stringify(a.map(p => p.id)) === JSON.stringify(b.map(p => p.id))
            },
            {
                prop: '_pendingInvitations', value: roomState.pendingInvitations,
                compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
            },
            { prop: '_maxPlayers', value: roomState.maxPlayers },
            { prop: '_state', value: roomState.state }
        ];

        updates.forEach(({ prop, value, compare }) => {
            if (compare ? !compare(this[prop], value) : this[prop] !== value) {
                logChange(prop, this[prop], value);
                this[prop] = value;
                hasChanged = true;
            }
        });

        if (hasChanged) {
            logger.info("PongRoom state has changed, current state:", {
                mode: this._mode,
                owner: this._owner,
                players: this._players,
                pendingInvitations: this._pendingInvitations,
                maxPlayers: this._maxPlayers,
                state: this._state,
                currentUser: this._currentUser
            });
            this.logCurrentState();
            dynamicRender.scheduleUpdate();
        } else {
            logger.info("No state changes detected");
        }
    }

    destroy() {
        if (this._pongGame) {
            this._pongGame.destroy();
            this._pongGame = null;
        }
        if (this.wsService) {
            this.wsService.destroy('pongRoom');
        }
    }

    logCurrentState() {
        logger.info("PongRoom - Current state:", {
            roomId: this._roomId,
            mode: this._mode,
            owner: this._owner,
            players: this._players,
            pendingInvitations: this._pendingInvitations,
            maxPlayers: this._maxPlayers,
            availableSlots: this.availableSlots,
            state: this._state,
            currentUser: this._currentUser
        });
    }

    setLoading(isLoading) {
        const startButton = document.querySelector('#startGameBtn');
        if (startButton) {
            startButton.disabled = isLoading;
            startButton.textContent = isLoading ? 'Starting...' : 'Start Game';
        }
    }

    setStarted(isStarted) {
        const startButton = document.querySelector('#startGameBtn');
        if (startButton) {
            startButton.disabled = isStarted;
            startButton.textContent = isStarted ? 'Started' : 'Start Game';
        }
    }

    // Add helper method for connection error handling
    handleConnectionError(code) {
        const errorMessages = {
            4001: "Authentication failed. Please refresh the page and try again.",
            4003: "You are not authorized to join this game.",
            4004: "Game not found. It may have been deleted.",
            1006: "Connection closed abnormally. Will retry..."
        };

        const message = errorMessages[code] || `Connection failed with code ${code}`;
        logger.error(message);

        return code === 1006; // Only retry on abnormal closure
    }
}

export default PongRoom;
