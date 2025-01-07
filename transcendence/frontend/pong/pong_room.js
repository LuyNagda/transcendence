import dynamicRender from "../utils/dynamic_render.js";
import logger from "../utils/logger.js";
import WSService from "../utils/WSService.js";
import { PongGameController } from "./PongGameController.js";

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

        const defaultState = {
            id: roomState.id,
            currentUser: roomState.currentUser,
            mode: 'CLASSIC',
            owner: { id: null, username: null },
            players: [],
            pendingInvitations: [],
            maxPlayers: 0,
            state: 'LOBBY'
        };

        const mergedState = { ...defaultState, ...roomState };

        if (!this.instance) {
            logger.info("Creating new PongRoom instance");
            this.instance = new PongRoom(mergedState.id, mergedState.currentUser);
            logger.debug("Adding PongRoom to observed objects");
            dynamicRender.addObservedObject('pongRoom', this.instance);
        }

        logger.info("Updating PongRoom state with:", mergedState);
        this.instance.updateFromState(mergedState);

        logger.debug("Current observed objects:", {
            keys: Array.from(dynamicRender.observedObjects.keys()),
            pongRoomExists: dynamicRender.observedObjects.has('pongRoom')
        });

        this.instance.setStarted(false);
    }
}

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
    logger.debug("htmx:beforeSwap event fired");
    try {
        // Create a temporary div to parse the HTML string
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = event.detail.serverResponse;

        const roomStateData = tempDiv.querySelector('#room-state-data');
        if (roomStateData) {
            logger.debug("Found room state data");
            const roomState = JSON.parse(roomStateData.textContent.trim());
            logger.debug("Parsed room state:", roomState);
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
            if (roomIdElement)
                roomId = JSON.parse(roomIdElement.textContent);
            if (!roomId)
                throw new Error('Room ID is required');
        }

        this._roomId = roomId;
        this._currentUser = currentUser;
        this._mode = 'AI';
        this._owner = { id: null, username: null };
        this._players = [];
        this._pendingInvitations = [];
        this._maxPlayers = 0;
        this._state = "LOBBY";
        this._pongGame = null;
        this._useWebGL = false;
        this._aiName = 'medium';
        this._savedAi = [];

        this.initializeWebSocket();
        this.initializeEventListeners();
        this.fetchSavedAI();
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
        document.addEventListener('click', (event) => {
            if (event.target && event.target.id === 'startGameBtn') {
                this.startGame();
            }
        });
    }

    // // // TODO: New fetch to implement
    // // Fetch saved AIs and populate the dropdown
    // async function fetchSavedAIs() {
    //     const dropdown = document.getElementById('ai-difficulty');

    //     try {
    //         const response = await fetch('/ai/list-saved-ai', {
    //             method: 'GET'
    //         });

    //         if (!response.ok) {
    //             const data = await response.json();
    //             throw new Error(data.error || 'Fetching saved AIs failed');
    //         }

    //         const data = await response.json();
    //         dropdown.innerHTML = '<option value="" disabled selected>Select AI</option>';
    //         data.saved_ai.forEach(ai => {
    //             const option = document.createElement("option");
    //             option.value = ai;
    //             option.textContent = ai;
    //             dropdown.appendChild(option);
    //         });
    //     } catch(error) {
    //         managingLog.className = 'alert alert-danger';
    //         managingLog.innerText = `Error: ${error.message}`;
    //     }
    // }

    // Fetch AI list from the backend
    async fetchSavedAI() {
        const apiUrl = '/ai/list-saved-ai'; // Adjust the endpoint if necessary
        try {
            const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }

        const data = await response.json();
        this._savedAi = data.saved_ai;
        this.populateDropdown(); // Populate the dropdown once data is fetched
        } catch (error) {
            console.error('Error fetching saved AI:', error);
        }
    }
    
    // Populate the dropdown dynamically
    populateDropdown() {
        const selectElement = document.getElementById('ai-difficulty');
        if (!selectElement) {
            console.error('Dropdown element not found');
            return;
        }
        
        // Clear existing options
        selectElement.innerHTML = '';
        
        // Add a placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.textContent = 'Select an AI';
        placeholderOption.value = '';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        selectElement.appendChild(placeholderOption);
        
        // Add options from the savedAI list
        this._savedAi.forEach((ai) => {
            const option = document.createElement('option');
            option.value = ai;
            option.textContent = ai;
            selectElement.appendChild(option);
        });
    }
    //////////////////////////////////////////////////////////////
    // Getters
    //////////////////////////////////////////////////////////////
    get roomId() { return this._roomId; }
    get mode() { return this._mode; }
    get owner() { return this._owner; }
    get players() { return this._players; }
    get pendingInvitations() { return this._pendingInvitations; }
    get maxPlayers() { return this._maxPlayers; }
    get availableSlots() {
        const playerCount = Array.isArray(this._players) ? this._players.length : 0;
        const invitationCount = Array.isArray(this._pendingInvitations) ? this._pendingInvitations.length : 0;
        return this._maxPlayers - playerCount - invitationCount;
    }
    get state() { return this._state; }
    get currentUser() { return this._currentUser; }
    get useWebGL() { return this._useWebGL; }
    get aiDifficulty() { return this._aiName; }
    set aiDifficulty(value) {
        this.updateAIDifficulty(value);
    }

    //////////////////////////////////////////////////////////////
    // Setters
    //////////////////////////////////////////////////////////////
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

    updateAIDifficulty(value) {
        if (this._aiName !== value) {
            logger.info(`Setting AI difficulty from ${this._aiName} to ${value}`);
            this._aiName = value;
            this.notifyUpdate("_aiName", value);
            if (this._pongGame) {
                this._pongGame.setAIMode(true, value);
            }
            dynamicRender.scheduleUpdate();
        }
    }

    //////////////////////////////////////////////////////////////
    // WebSocket event handlers
    //////////////////////////////////////////////////////////////
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

        // Create new game instance
        const isHost = this._currentUser.id === data.player1_id;
        this._pongGame = new PongGameController(data.game_id, this._currentUser, isHost, this._useWebGL);

        // Add delay and retry logic for initialization
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        while (retryCount < maxRetries) {
            try {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                const initialized = await this._pongGame.initialize();
                if (!initialized)
                    throw new Error("Game initialization failed");
                this._pongGame.setAIMode(true, this._aiName);
                const started = await this._pongGame.start();
                if (!started)
                    throw new Error("Game start failed");
                this.setStarted(true);
                this.updateState('PLAYING');
                dynamicRender.scheduleUpdate();
                return;

            } catch (error) {
                retryCount++;
                logger.error("Game initialization/start attempt failed:", error);

                if (retryCount === maxRetries) {
                    logger.error("Max retry attempts reached for game initialization");
                    if (this._pongGame) {
                        this._pongGame.destroy();
                        this._pongGame = null;
                    }
                    this.updateState('LOBBY');
                    return;
                }
            }
        }
    }

    handleWebSocketClose(event) {
        // Normal closure (1000) or Going Away (1001) are expected during page reload
        if (event.code !== 1000 && event.code !== 1001) {
            logger.error("WebSocket closed unexpectedly", event);
        } else {
            logger.debug("WebSocket closed normally", event);
        }
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

    //////////////////////////////////////////////////////////////
    // User actions
    //////////////////////////////////////////////////////////////
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
            if (this._players.length < this._maxPlayers) {
                logger.error("Cannot start game: not enough players");
                return null;
            }
            this._useWebGL = document.getElementById('webgl-toggle')?.checked || false;
            this.sendMessage('start_game', { id: Date.now() });
            this.setLoading(true);
        } catch (error) {
            logger.error('Error sending start game request:', error);
            this.setLoading(false);
        }
    }

    updateFromState(roomState) {
        logger.debug("updateFromState called with:", roomState);
        let hasChanged = false;

        const logChange = (property, oldValue, newValue) => {
            logger.debug(`Property ${property} changed:`, { old: oldValue, new: newValue });
        };

        // Ensure roomState properties exist with defaults
        const safeState = {
            mode: roomState.mode || 'CLASSIC',
            owner: roomState.owner || { id: null, username: null },
            players: Array.isArray(roomState.players) ? roomState.players : [],
            pendingInvitations: Array.isArray(roomState.pendingInvitations) ? roomState.pendingInvitations : [],
            maxPlayers: roomState.maxPlayers || 0,
            state: roomState.state || 'LOBBY'
        };

        // Check and update each property
        const updates = [
            { prop: '_mode', value: safeState.mode },
            { prop: '_owner', value: safeState.owner, compare: (a, b) => a && b && a.id === b.id },
            {
                prop: '_players', value: safeState.players, compare: (a, b) =>
                    Array.isArray(a) && Array.isArray(b) &&
                    JSON.stringify(a.map(p => p.id)) === JSON.stringify(b.map(p => p.id))
            },
            {
                prop: '_pendingInvitations', value: safeState.pendingInvitations,
                compare: (a, b) => Array.isArray(a) && Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b)
            },
            { prop: '_maxPlayers', value: safeState.maxPlayers },
            { prop: '_state', value: safeState.state }
        ];

        updates.forEach(({ prop, value, compare }) => {
            if (compare ? !compare(this[prop], value) : this[prop] !== value) {
                logChange(prop, this[prop], value);
                this[prop] = value;
                hasChanged = true;
            }
        });

        if (hasChanged) {
            logger.debug("PongRoom state has changed, current state:", {
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
            logger.debug("No state changes detected");
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

function initializePongRoomIfPresent() {
    const pongRoomElement = document.getElementById('pong-room');
    if (!pongRoomElement) return;

    try {
        const roomId = JSON.parse(document.getElementById("room-id").textContent);
        const currentUser = JSON.parse(document.getElementById("current-user-data").textContent);

        window.pongRoomManager.initialize({
            id: roomId,
            currentUser: currentUser
        });

        logger.info('Pong room initialized successfully', { roomId });
    } catch (error) {
        logger.error('Failed to initialize pong room:', error);
    }
}

document.addEventListener("DOMContentLoaded", initializePongRoomIfPresent);
document.body.addEventListener("htmx:afterSwap", initializePongRoomIfPresent);

export default PongRoom;
