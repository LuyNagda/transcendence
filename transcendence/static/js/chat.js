const chatSocket = new WebSocket(
	'ws://' + window.location.host + '/ws/chat/'
);

const currentUserId = document.body.dataset.userId;

chatSocket.onmessage = function (e) {
	const data = JSON.parse(e.data);
	if (data.type === 'chat_message') {
		addMessage(data.message, data.sender_id);
	} else if (data.type === 'game_invitation') {
		handleGameInvitation(data.game_id, data.sender_id);
	} else if (data.type === 'tournament_warning') {
		handleTournamentWarning(data.tournament_id, data.match_time);
	} else if (data.type === 'user_profile') {
		displayUserProfile(data.profile);
	}
};

function addMessage(message, senderId) {
	const messageHistory = document.getElementById('message-history');
	const messageElement = document.createElement('div');
	messageElement.classList.add('message');
	messageElement.classList.add(senderId === currentUserId ? 'sent' : 'received');
	messageElement.innerHTML = `
        <p>${message}</p>
        <small>${new Date().toLocaleTimeString()}</small>
    `;
	messageHistory.appendChild(messageElement);
	messageHistory.scrollTop = messageHistory.scrollHeight;
}

document.querySelector('#chat-form').addEventListener('submit', function (e) {
	e.preventDefault();
	const messageInput = document.querySelector('#chat-message');
	const message = messageInput.value;
	const activeUser = document.querySelector('.user-chat.active'); // Ensure there's an active user
	if (!activeUser) {
		alert("Please select a user to chat with.");
		return;
	}
	const recipientId = activeUser.dataset.userId;
	console.log("Sending message to:", recipientId); // Debug: Log recipient ID
	chatSocket.send(JSON.stringify({
		'type': 'chat_message',
		'message': message,
		'recipient_id': recipientId
	}));

	messageInput.value = '';
});

document.querySelectorAll('.user-chat').forEach(function (element) {
	element.addEventListener('click', function (e) {
		e.preventDefault();
		const userId = this.dataset.userId;
		console.log("User selected:", userId); // Debug: Log selected user ID
		document.querySelectorAll('.user-chat').forEach(el => el.classList.remove('active'));
		this.classList.add('active');
		loadMessageHistory(userId);
	});
});

function loadMessageHistory(userId) {
	fetch(`/chat/history/${userId}/`)
		.then(response => response.text())
		.then(html => {
			document.getElementById('message-history').innerHTML = html;
		});
}

document.querySelectorAll('.block-user, .unblock-user').forEach(function (element) {
	element.addEventListener('click', function () {
		const userId = this.dataset.userId;
		const action = this.classList.contains('block-user') ? 'block' : 'unblock';
		fetch(`/chat/${action}/${userId}/`, { method: 'POST' })
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					this.classList.toggle('block-user');
					this.classList.toggle('unblock-user');
					this.textContent = action === 'block' ? 'Unblock' : 'Block';
				}
			});
	});
});

document.querySelectorAll('.invite-pong').forEach(function (element) {
	element.addEventListener('click', function () {
		const userId = this.dataset.userId;
		chatSocket.send(JSON.stringify({
			'type': 'game_invitation',
			'recipient_id': userId,
			'game_id': 'pong'
		}));
	});
});

document.querySelectorAll('.view-profile').forEach(function (element) {
	element.addEventListener('click', function () {
		const userId = this.dataset.userId;
		chatSocket.send(JSON.stringify({
			'type': 'get_profile',
			'user_id': userId
		}));
	});
});

function handleGameInvitation(gameId, senderId) {
	if (confirm(`You've been invited to play ${gameId}. Do you want to accept?`)) {
		window.location.href = `/games/${gameId}/?opponent=${senderId}`;
	}
}

function handleTournamentWarning(tournamentId, matchTime) {
	alert(`Your next match in tournament ${tournamentId} is scheduled for ${matchTime}`);
}

function displayUserProfile(profile) {
	const profileModal = document.createElement('div');
	profileModal.classList.add('profile-modal');
	profileModal.innerHTML = `
        <h2>${profile.username}'s Profile</h2>
        <p>Email: ${profile.email}</p>
        <p>Bio: ${profile.bio}</p>
        <img src="${profile.profile_picture}" alt="Profile Picture"> <!-- Display profile picture if available -->
    `;
	document.body.appendChild(profileModal);

	profileModal.addEventListener('click', function () {
		document.body.removeChild(profileModal);
	});
}