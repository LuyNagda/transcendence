export default class MessageService {
	constructor(uiHandler, userService) {
		this.uiHandler = uiHandler;
		this.userService = userService;
	}

	addMessage(message, senderId, timestamp, isSent) {
		senderId = parseInt(senderId, 10);
		const messageElement = document.createElement('div');
		messageElement.classList.add('chat-bubble', isSent ? 'sent' : 'received');
		messageElement.setAttribute('data-user-id', senderId);

		const senderName = isSent ? 'You' : this.userService.getUserName(senderId) || 'Unknown User';

		const formattedTimestamp = timestamp
			? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

		const statusIconHTML = !isSent ? `
            <span class="status-icon" aria-label="User status">
                ${this.userService.getUserStatusIcon(senderId)}
            </span>
        ` : '';

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
}