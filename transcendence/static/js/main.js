// transcendence/frontend/logger.js
var Logger = class {
  constructor() {
    this.debugSettings = false;
    this.logLevel = "ERROR";
    this.levels = {
      "DEBUG": 10,
      "INFO": 20,
      "WARN": 30,
      "ERROR": 40
    };
    this.currentLevel = this.levels["ERROR"];
    this.queue = [];
    this.initialized = false;
  }
  initialize() {
    const bodyElement = document.body;
    this.debugSettings = bodyElement.dataset.debug === "True";
    this.logLevel = bodyElement.dataset.logLevel || "ERROR";
    this.currentLevel = this.levels[this.logLevel.toUpperCase()] || this.levels["ERROR"];
    this.initialized = true;
    this.processQueue();
  }
  processQueue() {
    while (this.queue.length > 0) {
      const { level, messages } = this.queue.shift();
      this.log(level, ...messages);
    }
  }
  log(level, ...messages) {
    if (!this.initialized) {
      this.queue.push({ level, messages });
      return;
    }
    if (this.levels[level.toUpperCase()] >= this.currentLevel) {
      console[level.toLowerCase()](...messages);
    }
  }
  debug(...messages) {
    this.log("DEBUG", ...messages);
  }
  info(...messages) {
    this.log("INFO", ...messages);
  }
  warn(...messages) {
    this.log("WARN", ...messages);
  }
  error(...messages) {
    this.log("ERROR", ...messages);
  }
};
var logger = new Logger();

// transcendence/frontend/theme.js
var themeLocal = localStorage.getItem("themeLocal") || "light";
var sizeLocal = localStorage.getItem("sizeLocal") || "small";
var navbarBrand = document.querySelector(".navbar-brand");
var btn = document.querySelector(".btn");
var formControls = document.querySelectorAll(".form-control");
var toggleFontSizeBtn = document.getElementById("toggleFontSizeBtn");
function applyFontSize(size) {
  if (size == "large") {
    localStorage.setItem("sizeLocal", "large");
    document.body.style.fontSize = "1.5rem";
    if (navbarBrand) navbarBrand.style.fontSize = "1.5rem";
    if (btn) btn.style.fontSize = "1.5rem";
    if (formControls) {
      formControls.forEach(function(formControl) {
        formControl.style.fontSize = "1.5rem";
        formControl.style.paddingTop = "3rem";
        formControl.style.paddingBottom = "2rem";
      });
    }
  } else {
    localStorage.setItem("sizeLocal", "small");
    document.body.style.fontSize = "1rem";
    if (navbarBrand) navbarBrand.style.fontSize = "1.25rem";
    if (btn) btn.style.fontSize = "1rem";
    if (formControls) {
      formControls.forEach(function(formControl) {
        formControl.style.fontSize = "1rem";
        formControl.style.padding = "0.375rem 0.75rem";
      });
    }
  }
}
function applyTheme(theme) {
  localStorage.setItem("themeLocal", theme);
  document.documentElement.setAttribute("data-bs-theme", theme);
  var themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    switch (theme) {
      case "light":
        themeIcon.setAttribute("d", "M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708");
        break;
      case "dark":
        themeIcon.setAttribute("d", "M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286");
        break;
      case "high-contrast":
        themeIcon.setAttribute("d", "M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0");
        break;
    }
  }
}
function initializeThemeAndFontSize() {
  applyFontSize(sizeLocal);
  applyTheme(themeLocal);
  if (toggleFontSizeBtn) {
    toggleFontSizeBtn.checked = sizeLocal === "large";
    toggleFontSizeBtn.addEventListener("click", function() {
      applyFontSize(this.checked ? "large" : "small");
    });
  }
  document.getElementById("light")?.addEventListener("click", () => applyTheme("light"));
  document.getElementById("dark")?.addEventListener("click", () => applyTheme("dark"));
  document.getElementById("highContrast")?.addEventListener("click", () => applyTheme("high-contrast"));
}

// transcendence/frontend/chat/WSService.js
var WSService = class {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.messageQueue = [];
    this.isConnected = false;
    this.onMessageCallbacks = [];
    this.onOpenCallbacks = [];
    this.onCloseCallbacks = [];
    this.onErrorCallbacks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.initialize();
  }
  initialize() {
    this.connect();
  }
  connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      console.debug("WebSocket connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.processQueue();
      this.onOpenCallbacks.forEach((callback) => callback());
    };
    this.socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      this.onMessageCallbacks.forEach((callback) => callback(data));
    };
    this.socket.onclose = (e) => {
      console.warn(`WebSocket closed: ${e.code}, Reason: ${e.reason}`);
      this.isConnected = false;
      this.onCloseCallbacks.forEach((callback) => callback(e));
      this.handleReconnection();
    };
    this.socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      this.onErrorCallbacks.forEach((callback) => callback(err));
    };
  }
  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1e3 * Math.pow(2, this.reconnectAttempts), 6e4);
      console.info(`Reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error("Max reconnect attempts reached.");
      alert("Unable to reconnect. Please refresh the page.");
    }
  }
  send(message) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected. Queueing message.");
      this.messageQueue.push(message);
      if (this.socket.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }
  processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }
  onMessage(callback) {
    this.onMessageCallbacks.push(callback);
  }
  onOpen(callback) {
    this.onOpenCallbacks.push(callback);
  }
  onClose(callback) {
    this.onCloseCallbacks.push(callback);
  }
  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }
};

// transcendence/frontend/chat/UserService.js
var UserService = class {
  constructor() {
    this.currentUserId = this.getCurrentUserId();
  }
  getCurrentUserId() {
    const userId = document.body.dataset.userId;
    if (!userId) {
      console.error("User ID not found in body dataset.");
      return null;
    }
    return parseInt(userId, 10);
  }
  getUserName(userId) {
    const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
    return userElement ? userElement.querySelector(".user-name").textContent.trim() : "Unknown User";
  }
  getUserStatusIcon(userId) {
    const status = this.getUserStatus(userId);
    switch (status) {
      case "online":
        return "&#x1F7E2;";
      // Green circle
      case "offline":
        return "&#x26AA;";
      // White circle
      case "blocked":
        return "&#x1F534;";
      // Red circle
      default:
        return "&#x26AA;";
    }
  }
  getUserStatus(userId) {
    const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
    if (userElement) {
      if (userElement.classList.contains("online")) return "online";
      if (userElement.classList.contains("blocked")) return "blocked";
    }
    return "offline";
  }
  updateUserStatus(userId, status) {
    const userElement = document.querySelector(`.user-chat[data-user-id="${userId}"]`);
    if (userElement) {
      const statusIcon = userElement.querySelector(".status-icon");
      statusIcon.innerHTML = this.getUserStatusIcon(userId);
      userElement.classList.remove("online", "offline", "blocked");
      userElement.classList.add(status);
      const messageBubbles = document.querySelectorAll(`.chat-bubble[data-user-id="${userId}"] .status-icon`);
      messageBubbles.forEach((icon) => {
        icon.innerHTML = this.getUserStatusIcon(userId);
        icon.classList.remove("online", "offline", "blocked");
        icon.classList.add(status);
      });
    }
  }
};

// transcendence/frontend/chat/MessageService.js
var MessageService = class {
  constructor(uiHandler, userService) {
    this.uiHandler = uiHandler;
    this.userService = userService;
  }
  addMessage(message, senderId, timestamp, isSent) {
    senderId = parseInt(senderId, 10);
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-bubble", isSent ? "sent" : "received");
    messageElement.setAttribute("data-user-id", senderId);
    const senderName = isSent ? "You" : this.userService.getUserName(senderId) || "Unknown User";
    const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const statusIconHTML = !isSent ? `
            <span class="status-icon" aria-label="User status">
                ${this.userService.getUserStatusIcon(senderId)}
            </span>
        ` : "";
    messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender-name">${senderName}</span>
                ${statusIconHTML}
            </div>
            <p>${message}</p>
            <small>${formattedTimestamp}</small>
        `;
    this.uiHandler.messageHistory.appendChild(messageElement);
    this.uiHandler.messageHistory.scrollTop = this.uiHandler.messageHistory.scrollHeight;
  }
};

// transcendence/frontend/chat/UIHandler.js
var UIHandler = class {
  constructor(chatApp) {
    this.chatApp = chatApp;
    this.messageHistory = document.getElementById("message-history");
    this.chatForm = document.querySelector("#chat-form");
    this.chatCanvas = document.getElementById("ChatCanvas");
    this.chatHeading = document.getElementById("chatHeading");
    this.unreadBadge = document.getElementById("unreadBadge");
    this.chatIcon = document.querySelector(".chat-icon i");
    this.chatBadge = document.querySelector(".chat-badge");
    this.attachEventListeners();
  }
  attachEventListeners() {
    if (this.chatForm) {
      this.chatForm.addEventListener("submit", (e) => this.chatApp.handleFormSubmit(e));
    }
    document.querySelectorAll(".user-chat").forEach((element) => {
      element.addEventListener("click", (e) => this.chatApp.handleUserClick(e));
    });
    document.querySelectorAll(".block-user, .unblock-user").forEach((element) => {
      element.addEventListener("click", (e) => this.chatApp.handleUserBlockToggle(e));
    });
    document.querySelectorAll(".invite-pong, .view-profile").forEach((element) => {
      element.addEventListener("click", (e) => this.chatApp.handleSpecialActions(e));
    });
    if (this.chatCanvas) {
      this.chatCanvas.addEventListener("show.bs.offcanvas", () => this.chatApp.resetUnreadMessageCount());
      this.chatCanvas.addEventListener("hide.bs.offcanvas", () => this.chatApp.setChatModalOpen(false));
    }
  }
  updateChatIcon(unreadCount) {
    if (unreadCount > 0) {
      this.chatIcon.classList.remove("text-secondary");
      this.chatIcon.classList.add("text-primary");
      this.chatBadge.textContent = unreadCount > 99 ? "99+" : unreadCount;
      this.chatBadge.style.display = "inline";
    } else {
      this.chatIcon.classList.remove("text-primary");
      this.chatIcon.classList.add("text-secondary");
      this.chatBadge.style.display = "none";
    }
  }
  updateChatHeading(userName, messageCount) {
    this.chatHeading.textContent = `Chat with ${userName}`;
    this.unreadBadge.textContent = messageCount;
    let visuallyHidden = this.unreadBadge.querySelector(".visually-hidden");
    if (!visuallyHidden) {
      visuallyHidden = document.createElement("span");
      visuallyHidden.className = "visually-hidden";
      this.unreadBadge.appendChild(visuallyHidden);
    }
    visuallyHidden.textContent = `${messageCount} messages`;
  }
  displayProfileModal(profile) {
    const existingModal = document.querySelector(".profile-modal");
    if (existingModal) {
      document.body.removeChild(existingModal);
    }
    const modal = document.createElement("div");
    modal.classList.add("profile-modal");
    modal.innerHTML = `
            <h2>${profile.username}'s Profile</h2>
            <p>Email: ${profile.email}</p>
            <p>Bio: ${profile.bio}</p>
            <img src="${profile.profile_picture}" alt="Profile Picture">
        `;
    document.body.appendChild(modal);
    modal.addEventListener("click", () => {
      document.body.removeChild(modal);
    });
  }
};

// transcendence/frontend/chat/ChatApp.js
var ChatApp = class {
  constructor() {
    this.WSService = null;
    this.userService = new UserService();
    this.uiHandler = new UIHandler(this);
    this.messageService = new MessageService(this.uiHandler, this.userService);
    this.messageCountByUser = {};
    this.setupCSRFTokenWatcher();
  }
  setupCSRFTokenWatcher() {
    if (this.getCSRFToken()) {
      this.initializeWebSocket();
    } else {
      this.tokenCheckInterval = setInterval(() => {
        if (this.getCSRFToken()) {
          this.initializeWebSocket();
          clearInterval(this.tokenCheckInterval);
        }
      }, 1e3);
    }
  }
  initializeWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    const wsUrl = `${protocol}${window.location.host}/ws/chat/`;
    this.WSService = new WSService(wsUrl);
    this.WSService.onMessage((data) => this.handleMessage(data));
    this.WSService.onClose(() => this.handleClose());
    this.WSService.onOpen(() => this.handleOpen());
  }
  // TODO : Implement JWT auth
  getAccessToken() {
    return localStorage.getItem("accessToken");
  }
  handleMessage(data) {
    console.debug("Received data:", data);
    switch (data.type) {
      case "chat_message":
        this.messageService.addMessage(data.message, data.sender_id, data.timestamp, false);
        if (!this.chatModalOpen) this.incrementUnreadMessageCount();
        break;
      case "game_invitation":
        this.handleGameInvitation(data.game_id, data.sender_id);
        break;
      case "tournament_warning":
        this.handleTournamentWarning(data.tournament_id, data.match_time);
        break;
      case "user_profile":
        this.uiHandler.displayProfileModal(data.profile);
        break;
      case "user_status_change":
        this.userService.updateUserStatus(data.user_id, data.status);
        break;
      case "error":
        alert("Error: " + data.error);
        break;
      default:
        console.warn("Unknown message type:", data.type);
    }
  }
  handleClose() {
    console.warn("WebSocket closed.");
    this.WSService.handleReconnection();
  }
  handleOpen() {
    console.debug("WebSocket connection established");
    this.reconnectAttempts = 0;
    this.WSService.processQueue();
  }
  handleFormSubmit(e) {
    e.preventDefault();
    const messageInput = document.querySelector("#chat-message");
    const message = messageInput.value.trim();
    if (!message) return;
    const activeUser = document.querySelector(".user-chat.active");
    if (!activeUser) {
      alert("Please select a user to chat with.");
      return;
    }
    const recipientId = activeUser.dataset.userId;
    if (!this.userService.currentUserId) {
      alert("Unable to send message. User ID not found.");
      return;
    }
    console.info(`Sending message to user ${recipientId}: ${message}`);
    this.WSService.send({
      type: "chat_message",
      message,
      recipient_id: recipientId
    });
    this.messageService.addMessage(message, this.userService.currentUserId, /* @__PURE__ */ new Date(), true);
    messageInput.value = "";
  }
  handleUserClick(e) {
    e.preventDefault();
    const userId = e.currentTarget.dataset.userId;
    this.selectedUserId = userId;
    document.querySelectorAll(".user-chat").forEach((el) => el.classList.remove("active"));
    e.currentTarget.classList.add("active");
    this.loadMessageHistory(userId);
    document.getElementById("chat-form-div").style.display = "block";
    this.updateChatHeading(userId);
    this.messageCountByUser[userId] = 0;
    this.uiHandler.updateChatIcon(0);
  }
  loadMessageHistory(userId) {
    fetch(`/chat/history/${userId}/`, {
      method: "GET",
      headers: {
        "X-CSRFToken": this.getCSRFToken(),
        "Content-Type": "application/json"
      }
    }).then((response) => response.json()).then((data) => {
      this.uiHandler.messageHistory.innerHTML = "";
      this.messageCountByUser[userId] = data.length;
      console.debug("Message history loaded:", data);
      data.forEach((message) => {
        try {
          const isSent = message.sender_id === this.userService.currentUserId;
          this.messageService.addMessage(message.content, message.sender_id, new Date(message.timestamp), isSent);
        } catch (error) {
          console.error("Error adding message:", error);
        }
      });
      this.uiHandler.messageHistory.scrollTop = this.uiHandler.messageHistory.scrollHeight;
      this.updateChatHeading(userId);
    }).catch((error) => {
      console.error("Error loading message history:", error);
    });
  }
  updateChatHeading(userId) {
    const userName = this.userService.getUserName(userId);
    const messageCount = this.messageCountByUser[userId] || 0;
    this.uiHandler.updateChatHeading(userName, messageCount);
  }
  handleUserBlockToggle(e) {
    e.preventDefault();
    const element = e.currentTarget;
    const userId = element.dataset.userId;
    const action = element.classList.contains("block-user") ? "block" : "unblock";
    const method = action === "block" ? "POST" : "DELETE";
    fetch(`/chat/${action}/${userId}/`, {
      method,
      headers: {
        "X-CSRFToken": this.getCSRFToken(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }).then((response) => {
      if (response.ok) return response.json();
      throw new Error("Network response was not ok.");
    }).then((data) => {
      if (data.success) {
        if (action === "block") {
          element.textContent = "Unblock";
          element.classList.remove("block-user", "btn-danger");
          element.classList.add("unblock-user", "btn-secondary");
        } else {
          element.textContent = "Block";
          element.classList.remove("unblock-user", "btn-secondary");
          element.classList.add("block-user", "btn-danger");
        }
        this.userService.updateUserStatus(userId, action === "block" ? "blocked" : "online");
      }
    }).catch((error) => {
      console.error("Error:", error);
      alert("An error occurred while processing your request.");
    });
  }
  handleSpecialActions(e) {
    const userId = e.currentTarget.dataset.userId;
    const isInvitePong = e.currentTarget.classList.contains("invite-pong");
    const type = isInvitePong ? "game_invitation" : "get_profile";
    const payload = isInvitePong ? { type: "game_invitation", recipient_id: userId, game_id: "pong" } : { type: "user_profile", user_id: userId };
    this.WSService.send(payload);
  }
  handleGameInvitation(gameId, senderId) {
    if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`)) {
      window.location.href = `/games/${gameId}/?opponent=${senderId}`;
    }
  }
  handleTournamentWarning(tournamentId, matchTime) {
    alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
  }
  incrementUnreadMessageCount() {
    this.unreadMessageCount++;
    this.uiHandler.updateChatIcon(this.unreadMessageCount);
  }
  resetUnreadMessageCount() {
    this.unreadMessageCount = 0;
    this.uiHandler.updateChatIcon(this.unreadMessageCount);
  }
  setChatModalOpen(isOpen) {
    this.chatModalOpen = isOpen;
    if (isOpen) {
      this.resetUnreadMessageCount();
    }
  }
  getCSRFToken() {
    const cookieValue = document.cookie.split("; ").find((row) => row.startsWith("csrftoken="));
    return cookieValue ? cookieValue.split("=")[1] : null;
  }
  destroy() {
    if (this.tokenCheckInterval)
      clearInterval(this.tokenCheckInterval);
  }
};

// transcendence/frontend/main.js
function initializeChatApp() {
  if (window.chatApp) {
    console.warn("ChatApp already initialized");
    return;
  }
  try {
    window.chatApp = new ChatApp();
    console.log("ChatApp initialized successfully");
  } catch (error) {
    console.error("Failed to initialize ChatApp:", error);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  logger.initialize();
  initializeThemeAndFontSize();
  initializeChatApp();
});
//# sourceMappingURL=main.js.map
