import dynamicRender from "../utils/dynamic_render.js";
import logger from "../utils/logger.js";
import WSService from "../utils/WSService.js";
import { PongGame } from "./pong_game.js";

export class PongRoom {
    constructor(roomId, currentUser) {
        this._roomId = roomId;
        this._currentUser = currentUser;
        this._mode = "";
        this._owner = {};
        this._players = [];
        this._pendingInvitations = [];
        this._maxPlayers = 0;
        this._state = "LOBBY";
        this._pongGame = null;

        this.initializeWebSocket();
        logger.info(`PongRoom instance created for room ${roomId}`);
        this.logCurrentState();
    }

    initializeWebSocket() {
        const wsUrl = `ws://${window.location.host}/ws/pong_room/${this._roomId}/`;
        this.wsService = new WSService();
        this.wsService.initializeConnection('pongRoom', wsUrl);

        this.wsService.on('pongRoom', 'onMessage', this.handleWebSocketMessage.bind(this));
        this.wsService.on('pongRoom', 'onClose', this.handleWebSocketClose.bind(this));
        this.wsService.on('pongRoom', 'onOpen', this.handleWebSocketOpen.bind(this));
        this.wsService.on('pongRoom', 'onError', this.handleWebSocketError.bind(this));
    }

    // Getters
    get roomId() {
        return this._roomId;
    }
    get mode() {
        return this._mode;
    }
    get owner() {
        return this._owner;
    }
    get players() {
        return this._players;
    }
    get pendingInvitations() {
        return this._pendingInvitations;
    }
    get maxPlayers() {
        return this._maxPlayers;
    }
    get availableSlots() {
        return this._maxPlayers - this._players.length - this._pendingInvitations.length;
    }
    get state() {
        return this._state;
    }
    get currentUser() {
        return this._currentUser;
    }

    changeMode(event) {
        const newMode = event.target.value;
        logger.info(`Changing mode to ${newMode}`);
        this.updateMode(newMode);
    }

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

        // Si nous n'avons pas déjà une instance de jeu (cas du non-hôte)
        if (!this._pongGame) {
            const isHost = this._currentUser.id === data.player1_id;
            this._pongGame = new PongGame(data.game_id, this._currentUser, isHost);
            await this._pongGame.connect();
        }

        // Mettre à jour l'interface utilisateur
        this.updateState('PLAYING');
        dynamicRender.scheduleUpdate();
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
        this.sendMessage("update_property", { property: property, value: value });
    }

    sendMessage(action, data = {}) {
        const message = {
            action: action,
            ...data,
        };
        logger.info(`Sending WebSocket message: ${JSON.stringify(message)}`);
        this.wsService.send('pongRoom', message);
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
        logger.info("startGame method called");
        try {
            logger.info("Starting game...");
            if (this._players.length < 2) {
                logger.error("Cannot start game: not enough players");
                return null;
            }

            // Demander au serveur de créer la partie
            const response = await this.wsService.send('pongRoom', {
                action: 'start_game'
            });

            if (response.status === 'success') {
                logger.info(`Game created with ID: ${response.game_id}`);

                // Créer l'instance de PongGame immédiatement pour l'hôte
                const isHost = this._currentUser.id === response.player1_id;
                this._pongGame = new PongGame(response.game_id, this._currentUser, isHost);

                // Initialiser la connexion P2P
                await this._pongGame.connect();

                // Mettre à jour l'état de la room
                this.updateState('PLAYING');

                return response.game_id;
            } else {
                logger.error('Failed to create game:', response.message);
                return null;
            }
        } catch (error) {
            logger.error('Error starting game:', error);
            return null;
        }
    }

    updateFromState(roomState) {
        let hasChanged = false;

        if (this._mode !== roomState.mode) {
            this._mode = roomState.mode;
            hasChanged = true;
        }
        if (this._owner.id !== roomState.owner.id) {
            this._owner = roomState.owner;
            hasChanged = true;
        }
        if (JSON.stringify(this._players.map(p => p.id)) !== JSON.stringify(roomState.players.map(p => p.id))) {
            this._players = roomState.players;
            hasChanged = true;
        }
        if (JSON.stringify(this._pendingInvitations) !== JSON.stringify(roomState.pending_invitations)) {
            this._pendingInvitations = roomState.pending_invitations;
            hasChanged = true;
        }
        if (this._maxPlayers !== roomState.max_players) {
            this._maxPlayers = roomState.max_players;
            hasChanged = true;
        }
        if (this._state !== roomState.state) {
            this._state = roomState.state;
            hasChanged = true;
        }
        if (hasChanged) {
            logger.info("PongRoom - State has changed");
            this.logCurrentState();
            dynamicRender.scheduleUpdate();
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
        logger.info("PongRoom - État actuel :", {
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
}
