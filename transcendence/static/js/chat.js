class ChatApp {
	constructor() {
		this.chatSocket = null;
		this.messageQueue = [];
		this.init();
	}

	async init() {
		try {
			await this.loadChatData();
			this.createWebSocketConnection();
			this.attachEventListeners();
		} catch (error) {
			console.error("Erreur lors de l'initialisation du chat:", error);
		}
	}

	async loadChatData() {
		try {
			const response = await fetch("/chat/load-data/");
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			this.renderUsers(data.users, data.blocked_users);
		} catch (error) {
			console.error("Erreur lors du chargement des données du chat:", error);
			throw error; // Propager l'erreur pour la gestion dans init()
		}
	}

	renderUsers(users, blockedUsers) {
		const userList = document.querySelector(".user-list ul");
		userList.innerHTML = "";
		users.forEach((user) => {
			const li = document.createElement("li");
			li.innerHTML = `
				<button class="btn btn-transparent btn-sm me-1 user-chat" data-user-id="${
					user.id
				}">
					<img src="${
						user.profile_picture || "/static/default-avatar.png"
					}" class="rounded-circle" style="max-width: 20px;" alt="${
				user.username
			}'s profile picture">
					${user.username}
					<span class="status-icon">
						${this.getStatusIcon(user.online, blockedUsers.includes(user.id))}
					</span>
				</button>
			`;
			userList.appendChild(li);
		});
	}

	getStatusIcon(isOnline, isBlocked) {
		if (isBlocked) return "&#x1F534;"; // Red circle
		return isOnline ? "&#x1F7E2;" : "&#x26AA;"; // Green or white circle
	}

	createWebSocketConnection() {
		const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
		this.chatSocket = new WebSocket(
			protocol + window.location.host + "/ws/chat/"
		);
		this.setupWebSocketHandlers();
	}

	setupWebSocketHandlers() {
		this.chatSocket.onmessage = (e) => this.handleMessage(e);
		this.chatSocket.onclose = (e) => this.handleClose(e);
		this.chatSocket.onerror = (err) => this.handleError(err);
		this.chatSocket.onopen = () => {
			console.log("WebSocket connection established");
			this.processMessageQueue();
		};
	}

	handleMessage(e) {
		const data = JSON.parse(e.data);
		console.log("Received data:", data);
		switch (data.type) {
			case "chat_message":
				this.addMessage(data.message, data.sender_id);
				break;
			case "game_invitation":
				this.handleGameInvitation(data.game_id, data.sender_id);
				break;
			case "tournament_warning":
				this.handleTournamentWarning(data.tournament_id, data.match_time);
				break;
			case "user_profile":
				this.displayUserProfile(data.profile);
				break;
			case "user_status_change":
				this.updateUserStatus(data.user_id, data.status);
				break;
			case "error":
				alert("Error: " + data.error);
				break;
		}
	}

	handleClose(e) {
		console.log(
			"Socket is closed. Reconnect will be attempted in 1 second.",
			e.reason
		);
		setTimeout(() => this.createWebSocketConnection(), 1000);
	}

	handleError(err) {
		console.error("Socket encountered error: ", err.message, "Closing socket");
		this.chatSocket.close();
	}

	attachEventListeners() {
		document
			.querySelector("#chat-form")
			.addEventListener("submit", (e) => this.handleFormSubmit(e));
		document.querySelectorAll(".user-chat").forEach((element) => {
			element.addEventListener("click", (e) => this.handleUserClick(e));
		});
		document
			.querySelectorAll(".block-user, .unblock-user")
			.forEach((element) => {
				element.addEventListener("click", (e) => this.handleUserBlockToggle(e));
			});
		document
			.querySelectorAll(".invite-pong, .view-profile")
			.forEach((element) => {
				element.addEventListener("click", (e) => this.handleSpecialActions(e));
			});
	}

	handleFormSubmit(e) {
		e.preventDefault();
		const messageInput = document.querySelector("#chat-message");
		const message = messageInput.value;
		const activeUser = document.querySelector(".user-chat.active");
		if (!activeUser) {
			alert("Please select a user to chat with.");
			return;
		}
		const recipientId = activeUser.dataset.userId;
		console.log("Sending message to:", recipientId);
		this.sendMessage(
			JSON.stringify({
				type: "chat_message",
				message: message,
				recipient_id: recipientId,
			})
		);
		this.addMessage(message, document.body.dataset.userId);
		messageInput.value = "";
	}

	handleUserClick(e) {
		e.preventDefault();
		const userId = e.currentTarget.dataset.userId;
		document
			.querySelectorAll(".user-chat")
			.forEach((el) => el.classList.remove("active"));
		e.currentTarget.classList.add("active");
		this.loadMessageHistory(userId);
		document.querySelector("#chat-form-div").style.display = "block";
	}

	handleUserBlockToggle(e) {
		e.preventDefault();
		const element = e.currentTarget;
		const userId = element.dataset.userId;
		const action = element.classList.contains("block-user")
			? "block"
			: "unblock";
		fetch(`/chat/${action}/${userId}/`)
			.then((response) => response.json())
			.then((data) => {
				if (data.success) {
					if (document.body.contains(element)) {
						element.classList.toggle("block-user");
						element.classList.toggle("unblock-user");
						element.textContent = action === "block" ? "Unblock" : "Block";
					}
					if (action === "unblock") {
						fetch(`/chat/status/${userId}/`)
							.then((response) => response.json())
							.then((statusData) => {
								if (document.body.contains(element)) {
									this.updateUserStatus(userId, statusData.status);
								}
							});
					} else {
						this.updateUserStatus(userId, "blocked");
					}
				}
			});
	}

	handleSpecialActions(e) {
		const userId = e.currentTarget.dataset.userId;
		const type = e.currentTarget.classList.contains("invite-pong")
			? "game_invitation"
			: "get_profile";
		const payload = {
			type: type,
			recipient_id: userId,
		};
		if (type === "game_invitation") payload.game_id = "pong";
		if (type === "get_profile") {
			delete payload.recipient_id;
			payload.user_id = userId;
		}
		this.sendMessage(payload);
	}

	sendMessage(payload) {
		if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
			this.chatSocket.send(JSON.stringify(payload));
		} else {
			console.log(
				"WebSocket not connected. Queueing message and attempting to reconnect..."
			);
			this.messageQueue.push(payload);
			this.createWebSocketConnection();
		}
	}

	processMessageQueue() {
		while (this.messageQueue.length > 0) {
			const message = this.messageQueue.shift();
			this.sendMessage(message);
		}
	}

	updateUserStatus(userId, status) {
		console.log("Updating user status:", userId, status);
		const userElement = document.querySelector(
			`.user-chat[data-user-id="${userId}"]`
		);
		if (userElement) {
			const statusIcon = userElement.querySelector(".status-icon");
			if (status === "online") {
				statusIcon.innerHTML = "&#x1F7E2;"; // Green circle
				userElement.classList.add("online");
				userElement.classList.remove("offline");
			} else if (status === "offline") {
				statusIcon.innerHTML = "&#x26AA;"; // White circle
				userElement.classList.add("offline");
				userElement.classList.remove("online");
			} else if (status === "blocked") {
				statusIcon.innerHTML = "&#x1F534;"; // Red circle
				userElement.classList.add("blocked");
				userElement.classList.remove("online", "offline");
			}
		}
	}

	addMessage(message, senderId) {
		const messageHistory = document.getElementById("message-history");
		const messageElement = document.createElement("div");
		messageElement.classList.add("message");
		messageElement.classList.add(
			senderId === document.body.dataset.userId ? "sent" : "received"
		);

		const senderName =
			senderId === document.body.dataset.userId
				? "You"
				: document
						.querySelector(`.user-chat[data-user-id="${senderId}"]`)
						.textContent.trim();
		const timestamp = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		messageElement.innerHTML = `
            <p>${message}</p>
            <small>${timestamp} - ${senderName}</small>
        `;
		messageHistory.appendChild(messageElement);
		messageHistory.scrollTop = messageHistory.scrollHeight;
	}

	loadMessageHistory(userId) {
		fetch(`/chat/history/${userId}/`)
			.then((response) => response.text())
			.then((html) => {
				document.getElementById("message-history").innerHTML = html;
			});
	}

	handleGameInvitation(gameId, senderId) {
		if (
			confirm(`You've been invited to play ${gameId}. Do you want to accept?`)
		) {
			window.location.href = `/games/${gameId}/?opponent=${senderId}`;
		}
	}

	handleTournamentWarning(tournamentId, matchTime) {
		alert(
			`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`
		);
	}

	displayUserProfile(profile) {
		const existingProfileModal = document.querySelector(".profile-modal");
		if (existingProfileModal) {
			document.body.removeChild(existingProfileModal);
		}

		const profileModal = document.createElement("div");
		profileModal.classList.add("profile-modal");
		profileModal.innerHTML = `
            <h2>${profile.username}'s Profile</h2>
            <p>Email: ${profile.email}</p>
            <p>Bio: ${profile.bio}</p>
            <img src="${profile.profile_picture}" alt="Profile Picture"> <!-- Display profile picture if available -->
        `;
		document.body.appendChild(profileModal);

		profileModal.addEventListener("click", function () {
			document.body.removeChild(profileModal);
		});
	}
}

// Initialisation de l'application
document.addEventListener("DOMContentLoaded", () => {
	new ChatApp();
});
