import dynamicRender from "../utils/dynamic_render.js";
import logger from "../utils/logger.js";

export class PongRoom {
    constructor(roomId, currentUser) {
        this._roomId = roomId;
        this._currentUser = currentUser;
        this._socket = null;
        this._isConnected = false;

        // Initialiser les autres propriétés avec des valeurs par défaut
        this._mode = "";
        this._owner = "";
        this._players = [];
        this._pendingInvitations = [];
        this._maxPlayers = 0;
        this._availableSlots = 0;
        this._state = "LOBBY";
        this._isInitialized = false;

        this.connect();
        logger.info(`PongRoom instance created for room ${roomId}`);
    }

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    connect() {
        if (this._isConnected) {
            console.warn("WebSocket is already connected.");
            return;
        }

        const csrftoken =
            this.getCookie("csrftoken") || document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

        const wsUrl = `ws://${window.location.host}/ws/pong_room/${this._roomId}/?token=${csrftoken}`;
        console.log("Attempting to connect to WebSocket:", wsUrl);
        this._socket = new WebSocket(wsUrl);

        this._socket.onmessage = this.handleWebSocketMessage.bind(this);
        this._socket.onclose = this.handleWebSocketClose.bind(this);
        this._socket.onopen = this.handleWebSocketOpen.bind(this);
        this._socket.onerror = this.handleWebSocketError.bind(this);
    }

    // Nouvelle méthode pour logger les valeurs initiales
    logInitialValues() {
        console.log("PongRoom - Valeurs initiales :");
        console.log("Room ID:", this._roomId);
        console.log("Mode:", this._mode);
        console.log("Owner:", this._owner);
        console.log("Players:", this._players);
        console.log("Pending Invitations:", this._pendingInvitations);
        console.log("Max Players:", this._maxPlayers);
        console.log("Available Slots:", this._availableSlots);
        console.log("State:", this._state);
        console.log("Current User:", this._currentUser);
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
        return this._availableSlots;
    }
    get state() {
        return this._state;
    }
    get currentUser() {
        return this._currentUser;
    }

    // Setters
    set mode(value) {
        this._mode = value;
        this.notifyUpdate("mode", value);
    }

    set owner(value) {
        this._owner = value;
        this.notifyUpdate("owner", value);
    }

    set players(value) {
        this._players = value;
        this.notifyUpdate("players", value);
    }

    set pendingInvitations(value) {
        this._pendingInvitations = value;
        this.notifyUpdate("pending_invitations", value);
    }

    set maxPlayers(value) {
        this._maxPlayers = value;
        this.notifyUpdate("max_players", value);
    }

    set availableSlots(value) {
        this._availableSlots = value;
        this.notifyUpdate("available_slots", value);
    }

    set state(value) {
        this._state = value;
        this.notifyUpdate("state", value);
    }

    handleWebSocketMessage(event) {
        console.log("WebSocket message received:", event.data);
        const data = JSON.parse(event.data);
        if (data.type === "room_update") {
            this.updateFromState(data.room_state);
            if (!this._isInitialized) {
                this.logInitialValues();
                this._isInitialized = true;
            }
        }
    }

    handleWebSocketClose(event) {
        console.error("WebSocket closed unexpectedly", event);
        this._isConnected = false;
        this._isInitialized = false;
        setTimeout(() => this.connect(), 5000);
    }

    handleWebSocketOpen(event) {
        console.log("WebSocket connection established", event);
        this._isConnected = true;
    }

    handleWebSocketError(event) {
        console.error("WebSocket error:", event);
        this._isConnected = false;
    }

    notifyUpdate(property, value) {
        const event = new CustomEvent("roomUpdate", {
            detail: { property: property, value: value },
        });
        document.dispatchEvent(event);
    }

    sendMessage(action, data = {}) {
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
                action: action,
                ...data,
            });
            console.log("Sending message:", message);
            this._socket.send(message);
        } else {
            console.error("WebSocket is not open. Unable to send message.");
        }
    }

    updateMode(newMode) {
        this.sendMessage("change_mode", { mode: newMode });
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

    startGame() {
        this.sendMessage("start_game");
    }

    updateFromState(roomState) {
        this.mode = roomState.mode;
        this.owner = roomState.owner;
        this.players = roomState.players;
        this.pendingInvitations = roomState.pending_invitations;
        this.maxPlayers = roomState.max_players;
        this.availableSlots = roomState.available_slots;
        this.state = roomState.state;
        dynamicRender.scheduleUpdate();
    }
}