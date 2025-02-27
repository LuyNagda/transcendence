import logger from '../logger';
import { BaseConnection, ConnectionState } from './BaseConnection';

/**
 * WebRTC connection implementation.
 * Handles peer connections, data channels, and ICE candidate negotiation.
 */
export class WebRTCConnection extends BaseConnection {
	constructor(name, config = {}) {
		super(name);
		this._config = config;
		this._peer = null;
		this._dataChannel = null;
		this._iceGatheringComplete = false;
		this._hasReceivedAnswer = false;
		this._pendingCandidates = [];
		this._hasRemoteDescription = false;
		this._isNegotiating = false;
		this._negotiationQueue = Promise.resolve(); // Add negotiation queue
		this._iceCandidateQueue = [];
		this._iceConnectionTimeout = null;

		logger.info('[WebRTCConnection] constructor', config);

		// Set up listener for ICE restart requests
		this.on('iceRestartNeeded', async () => {
			logger.debug(`[WebRTCConnection] ICE restart needed for ${name}`);
			if (this._config.isHost && this._peer && this._peer.signalingState !== 'closed') {
				try {
					// Create a new offer with ICE restart
					const offerOptions = { iceRestart: true };
					const offer = await this._peer.createOffer(offerOptions);
					await this._peer.setLocalDescription(offer);

					// Signal the new offer
					this.emit('signal', {
						type: 'offer',
						sdp: offer.sdp,
						iceRestart: true
					});

					logger.debug(`[WebRTCConnection] ICE restart offer created and sent for ${name}`);

					// Reset the ICE timeout
					this._setIceConnectionTimeout();
				} catch (error) {
					logger.error(`[WebRTCConnection] Error during ICE restart for ${name}:`, error);
				}
			} else if (!this._config.isHost) {
				// For guests, emit a signal to request ICE restart from host
				this.emit('signal', {
					type: 'iceRestart'
				});
				logger.debug(`[WebRTCConnection] ICE restart requested from host for ${name}`);
			}
		});
	}

	/**
	 * Establishes WebRTC peer connection
	 */
	async connect() {
		if (!this._state.canConnect) return;

		this.state = ConnectionState.CONNECTING;
		try {
			this._peer = new RTCPeerConnection(this._config);
			this._setupPeerHandlers();

			if (this._config.isHost) {
				logger.debug('Host: Creating data channel');
				this._dataChannel = this._peer.createDataChannel('gameData', {
					ordered: true,
					maxRetransmits: 3
				});
				this._setupDataChannelHandlers(this._dataChannel);
				await this._createAndSendOffer();
			}

			this.state = ConnectionState.SIGNALING;

			// Set a timeout for ICE connection establishment
			this._setIceConnectionTimeout();

			return Promise.resolve();
		} catch (error) {
			this._handleError(error);
			return Promise.reject(error);
		}
	}

	/**
	 * Sets a timeout for ICE connection establishment
	 * @private
	 */
	_setIceConnectionTimeout() {
		// Clear any existing timeout
		if (this._iceConnectionTimeout) {
			clearTimeout(this._iceConnectionTimeout);
		}

		// Set a new timeout (30 seconds is typical for ICE negotiation)
		this._iceConnectionTimeout = setTimeout(() => {
			if (this._peer && this._peer.iceConnectionState !== 'connected' &&
				this._peer.iceConnectionState !== 'completed') {
				logger.warn('ICE connection timeout - connection taking too long');
				this.emit('iceTimeout');
				// Don't disconnect here, just notify - the application can decide what to do
			}
		}, 30000);
	}

	/**
	 * Creates and sends an offer
	 * @private
	 */
	async _createAndSendOffer() {
		// Queue the negotiation to prevent concurrent offers
		this._negotiationQueue = this._negotiationQueue.then(async () => {
			try {
				if (this._peer.signalingState !== 'stable') {
					logger.debug('Skipping offer creation - signaling state not stable');
					return;
				}

				this._isNegotiating = true;
				logger.debug('Creating offer...');
				const offer = await this._peer.createOffer();

				// Double check signaling state before setting local description
				if (this._peer.signalingState !== 'stable') {
					logger.debug('Signaling state changed during offer creation, aborting');
					this._isNegotiating = false;
					return;
				}

				await this._peer.setLocalDescription(offer);
				this.emit('signal', {
					type: 'offer',
					sdp: offer.sdp
				});
			} catch (error) {
				logger.error('Error creating offer:', error);
				this._isNegotiating = false;
			}
		}).catch(error => {
			logger.error('Error in negotiation queue:', error);
			this._isNegotiating = false;
		});
	}

	/**
	 * Sets up WebRTC peer connection handlers
	 * @private
	 */
	_setupPeerHandlers() {
		this._peer.onicecandidate = (event) => {
			if (event.candidate) {
				logger.debug(`${this._config.isHost ? 'Host' : 'Guest'}: ICE candidate generated`);
				this.emit('signal', {
					type: 'candidate',
					candidate: event.candidate
				});
			} else {
				// Null candidate means ICE gathering is complete
				logger.debug('ICE gathering complete');
				this._iceGatheringComplete = true;
				this.emit('iceGatheringComplete');
			}
		};

		this._peer.oniceconnectionstatechange = () => {
			logger.debug(`ICE connection state changed to: ${this._peer.iceConnectionState}`);
			this.emit('iceConnectionStateChange', this._peer.iceConnectionState);

			if (this._peer.iceConnectionState === 'connected' ||
				this._peer.iceConnectionState === 'completed') {
				// Clear the ICE timeout when connected
				if (this._iceConnectionTimeout) {
					clearTimeout(this._iceConnectionTimeout);
					this._iceConnectionTimeout = null;
				}
				logger.info(`WebRTC ICE connection established in state: ${this._peer.iceConnectionState}`);
			} else if (this._peer.iceConnectionState === 'failed') {
				logger.warn("ICE connection failed. Attempting ICE restart.");
				this.emit('iceRestartNeeded');
			} else if (this._peer.iceConnectionState === 'disconnected') {
				logger.warn("ICE connection disconnected. Setting recovery timeout.");
				if (this._iceConnectionTimeout) {
					clearTimeout(this._iceConnectionTimeout);
				}
				this._iceConnectionTimeout = setTimeout(() => {
					if (this._peer && this._peer.iceConnectionState === 'disconnected')
						this.emit('iceRestartNeeded');
				}, 5000);
			}
		};

		this._peer.onconnectionstatechange = () => {
			logger.debug(`Connection state changed to: ${this._peer.connectionState}`);
			if (this._peer.connectionState === 'connected') {
				// Process any pending ICE candidates
				while (this._pendingCandidates.length > 0) {
					const candidate = this._pendingCandidates.shift();
					this._peer.addIceCandidate(new RTCIceCandidate(candidate))
						.catch(error => logger.error('Error adding pending ICE candidate:', error));
				}
				this.state = ConnectionState.CONNECTED;
				this.processQueue();
				logger.info("WebRTC peer connection fully established!");
			} else if (this._peer.connectionState === 'failed') {
				logger.error("WebRTC connection failed - peer connection state is 'failed'");
				this._handleError(new Error('WebRTC connection failed'));
			} else if (this._peer.connectionState === 'disconnected') {
				logger.warn("WebRTC peer connection disconnected");
				this.state = ConnectionState.DISCONNECTED;
			}
		};

		this._peer.onsignalingstatechange = () => {
			logger.debug(`Signaling state changed to: ${this._peer.signalingState}`);
			if (this._peer.signalingState === 'stable') {
				this._isNegotiating = false;

				if (this._hasRemoteDescription && this._pendingCandidates.length > 0) {
					logger.debug("Signaling state is stable, processing pending ICE candidates");
					this._processPendingCandidates();
				}
			}
		};

		this._peer.onnegotiationneeded = async () => {
			try {
				if (this._config.isHost && !this._isNegotiating) {
					logger.debug("Negotiation needed, creating offer");
					await this._createAndSendOffer();
				}
			} catch (error) {
				logger.error('Error during negotiation:', error);
				this._isNegotiating = false;
			}
		};

		if (!this._config.isHost) {
			this._peer.ondatachannel = (event) => {
				logger.debug('Guest: Received data channel');
				this._dataChannel = event.channel;
				this._setupDataChannelHandlers(this._dataChannel);
			};
		}
	}

	/**
	 * Sets up WebRTC data channel handlers
	 * @private
	 */
	_setupDataChannelHandlers(channel) {
		channel.onopen = () => {
			logger.debug(`Data channel ${channel.label} opened`);
			if (this._peer && this._peer.connectionState === 'connected') {
				this.state = ConnectionState.CONNECTED;
				this.processQueue();
				this.emit('open');
			}
		};

		channel.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('message', data);
			} catch (error) {
				logger.error(`Error parsing WebRTC message:`, error);
			}
		};

		channel.onclose = () => {
			logger.debug(`Data channel ${channel.label} closed`);
			this.state = ConnectionState.DISCONNECTED;
			this.emit('close');
		};

		channel.onerror = (error) => {
			logger.error(`Data channel ${channel.label} error:`, error);
			this._handleError(error);
		};
	}

	/**
	 * Creates and sets local offer for WebRTC connection
	 */
	async createOffer() {
		if (!this._peer || !this._config.isHost) return null;

		try {
			const offer = await this._peer.createOffer();
			await this._peer.setLocalDescription(offer);
			return offer;
		} catch (error) {
			this._handleError(error);
			return null;
		}
	}

	/**
	 * Handles incoming WebRTC offer
	 * @param {RTCSessionDescriptionInit} offer - WebRTC offer
	 */
	async handleOffer(offer) {
		if (!this._peer || this._config.isHost) return null;

		try {
			logger.debug('Guest: Setting remote description from offer');
			this.state = ConnectionState.SIGNALING;

			// If we already have a remote description, we need to rollback
			if (this._peer.signalingState !== 'stable') {
				logger.debug('Rolling back local description');
				await this._peer.setLocalDescription({ type: 'rollback' });
			}

			await this._peer.setRemoteDescription(new RTCSessionDescription(offer));
			this._hasRemoteDescription = true;

			// Process any pending ICE candidates now that we have the remote description
			if (this._pendingCandidates.length > 0) {
				await this._processPendingCandidates();
			}

			logger.debug('Guest: Remote description set, creating answer');

			const answer = await this._peer.createAnswer();
			await this._peer.setLocalDescription(answer);

			// Emit the answer signal
			this.emit('signal', {
				type: 'answer',
				sdp: answer.sdp
			});

			logger.debug('Guest: Answer created and sent');

			return answer;
		} catch (error) {
			logger.error('Error handling offer:', error);
			this._handleError(error);
			return null;
		}
	}

	/**
	 * Handles incoming WebRTC answer
	 * @param {RTCSessionDescriptionInit} answer - WebRTC answer
	 */
	async handleAnswer(answer) {
		if (!this._peer || !this._config.isHost) {
			logger.debug('Ignoring answer - not host');
			return;
		}

		try {
			logger.debug('Host: Setting remote description from answer');
			await this._peer.setRemoteDescription(new RTCSessionDescription(answer));
			this._hasRemoteDescription = true;
			this._hasReceivedAnswer = true;

			// Process any pending ICE candidates now that we have the remote description
			if (this._pendingCandidates.length > 0) {
				await this._processPendingCandidates();
			}

			logger.debug('Host: Remote description set, connection should be establishing');
		} catch (error) {
			logger.error('Error handling answer:', error);
			this._handleError(error);
		}
	}

	/**
	 * Processes queued ICE candidates
	 * @private
	 */
	async _processPendingCandidates() {
		if (!this._hasRemoteDescription) {
			logger.debug('Cannot process candidates without remote description');
			return;
		}

		if (!this._peer || this._peer.connectionState === 'closed') {
			logger.debug('Cannot process candidates - peer connection is closed or null');
			return;
		}

		const candidates = [...this._pendingCandidates];
		this._pendingCandidates = [];

		logger.debug(`Processing ${candidates.length} pending candidates`);

		for (const candidate of candidates) {
			try {
				await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
				logger.debug('Successfully added ICE candidate');
			} catch (error) {
				logger.warn('Error adding ICE candidate:', error);

				// In case of failure, requeue candidate if connection is still in progress
				if (this._peer &&
					this._peer.connectionState !== 'connected' &&
					this._peer.connectionState !== 'completed' &&
					this._peer.connectionState !== 'closed' &&
					this._peer.connectionState !== 'failed') {
					this._pendingCandidates.push(candidate);
				}
			}
		}
	}

	/**
	 * Handles incoming ICE candidate
	 * @param {RTCIceCandidateInit} candidate - ICE candidate
	 */
	async addIceCandidate(candidate) {
		if (!this._peer) return;

		try {
			if (this._hasRemoteDescription) {
				logger.debug('Adding ICE candidate immediately');
				await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
			} else {
				logger.debug('Remote description not set, queueing ICE candidate');
				this._pendingCandidates.push(candidate);
				logger.debug(`Total pending candidates: ${this._pendingCandidates.length}`);
			}
		} catch (error) {
			logger.error('Error adding ICE candidate:', error);
			this._pendingCandidates.push(candidate);
		}
	}

	/**
	 * Sends data through WebRTC data channel
	 * @param {*} data - Data to send
	 */
	send(data) {
		if (!this._state.canSend || !this._dataChannel || this._dataChannel.readyState !== 'open') {
			this.queueMessage(data);
			return;
		}

		try {
			this._dataChannel.send(JSON.stringify(data));
		} catch (error) {
			this.queueMessage(data);
			if (this._dataChannel.readyState === 'open') {
				this._handleError(error);
			} else {
				logger.warn(`WebRTC send failed - channel state: ${this._dataChannel.readyState}`);
				this.state = ConnectionState.DISCONNECTED;
			}
		}
	}

	/**
	 * Closes WebRTC connection
	 */
	disconnect() {
		if (!this._state.canDisconnect) return;

		// Clear any pending timeouts
		if (this._iceConnectionTimeout) {
			clearTimeout(this._iceConnectionTimeout);
			this._iceConnectionTimeout = null;
		}

		if (this._dataChannel) {
			this._dataChannel.close();
			this._dataChannel = null;
		}
		if (this._peer) {
			this._peer.close();
			this._peer = null;
		}
		this.state = ConnectionState.DISCONNECTED;
	}

	/**
	 * Handles WebRTC errors
	 * @private
	 */
	_handleError(error) {
		logger.error(`WebRTC error for ${this._name}:`, error);
		this.state = ConnectionState.ERROR;
		this.emit('error', error);
	}
}
