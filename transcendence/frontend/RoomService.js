import logger from './utils/logger.js';

export default class RoomService {
	static instance = null;

	constructor() {
		if (RoomService.instance)
			return RoomService.instance;

		this.pongRoom = {};
		this.initializePongRoomListener();

		RoomService.instance = this;
	}

	static getInstance() {
		if (!RoomService.instance)
			RoomService.instance = new RoomService();
		return RoomService.instance;
	}

	updatePongRoom(pongRoom) {
		if (pongRoom === 'None' || Object.keys.length() === 0) {
			this.pongRoom = null;
			document.body.setAttribute('data-pong-room', 'None');
			logger.debug('Pong Room data removed');
		} else {
			this.pongRoom = pongRoom;
			document.body.setAttribute('data-pong-room', pongRoom);
			logger.debug('Pong Room data updated:', pongRoom);
		}
	}

	getPongRoom() {
		return this.pongRoom;
	}

	initializePongRoomListener() {
		logger.debug('Initializing pongRoom listener');
		document.body.addEventListener('updatePongRoom', (event) => {
			logger.debug('Received updatePongRoom event:', event);
			this.updatePongRoom(event.detail.pongRoom);
		});
	}
}