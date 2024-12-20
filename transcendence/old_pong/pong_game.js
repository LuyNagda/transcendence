import logger from "../frontend/utils/logger.js";
import WSService from "../frontend/utils/WSService.js";
import WebGLConsole from "./pong_webgl.js";

export class PongGame {
  constructor(gameId, currentUser, isHost, useWebGL) {
    this._gameId = gameId;
    this._currentUser = currentUser;
    this._isHost = isHost;
    this._useWebGL = useWebGL;
    this._isConnected = false;
    this._peer = null;
    this._dataChannel = null;
    this._gameState = {
      leftPaddle: {
        x: 10,
        y: 262,
        width: 5,
        height: 30,
        dy: 0
      },
      rightPaddle: {
        x: 843,
        y: 262,
        width: 5,
        height: 30,
        dy: 0
      },
      ball: {
        x: 429,
        y: 262,
        width: 5,
        height: 5,
        dx: 2,
        dy: 0,
        resetting: false
      },
      leftScore: 0,
      rightScore: 0
    };

    // Enhanced WebRTC Configuration with TURN servers
    this._rtcConfig = {
      iceServers: [{ urls: 'stun:freestun.net:3478' }, { urls: 'turn:freestun.net:3478', username: 'free', credential: 'free' }],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
    };

    this._pendingCandidates = [];
    this._isICEGatheringComplete = false;
    this._hasRemoteDescription = false;

    // Lier les méthodes pour éviter les problèmes de contexte
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);

    this.webglConsole = null;

    // Add state reconciliation properties
    this._stateBuffer = [];
    this._lastProcessedStateTimestamp = 0;
    this._stateSequenceNumber = 0;
    this._lastConfirmedState = null;
    this._reconciliationInterval = 100; // ms
  }

  // Méthode pour démarrer la connexion
  async connect() {
    try {
      logger.info(`Connecting to game ${this._gameId} as ${this._isHost ? 'host' : 'guest'}`);

      if (!this._gameId)
        throw new Error('Game ID is required');

      await new Promise((resolve, reject) => {
        this.initializeWebSocket();

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        this.wsService.once('pongGame', 'onOpen', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.wsService.once('pongGame', 'onError', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Setup basic canvas first
      this.setupCanvas();
      this.setupGameControls();

      // Initialize WebGL only if it was enabled at game start
      if (this._useWebGL) {
        try {
          this.webglConsole = new WebGLConsole();
          const success = this.webglConsole.initializeWebGL();
          if (!success) {
            logger.warn("WebGL initialization failed, falling back to 2D canvas");
            this._useWebGL = false;
          }
        } catch (error) {
          logger.error("WebGL error:", error);
          this._useWebGL = false;
        }
      }

      // WebRTC init if it's the host
      logger.info("Host initializing WebRTC connection");
      await this.initializeWebRTC();

      // Set connected state directly instead of waiting for WebRTC
      this._isConnected = true;
      this.startGameLoop();

      return true;
    } catch (error) {
      logger.error('Error connecting to game:', error);
      this.destroy();
      return false;
    }
  }

  setupCanvas() {
    this.canvas = document.getElementById('game');
    this.context = this.canvas.getContext('2d');
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.canvas.width;
    this.bufferCanvas.height = this.canvas.height;
    this.bufferContext = this.bufferCanvas.getContext('2d');
  }

  initializeWebSocket() {
    this.wsService = new WSService();
    this.wsService.initializeConnection('pongGame', `/ws/pong_game/${this._gameId}/`);

    this.wsService.on('pongGame', 'onMessage', this.handleWebSocketMessage.bind(this));
    this.wsService.on('pongGame', 'onClose', this.handleWebSocketClose.bind(this));
    this.wsService.on('pongGame', 'onOpen', () => {
      logger.info(`WebSocket connection established for game ${this._gameId}`);
      // Send player ready message with additional info
      this.wsService.send('pongGame', {
        type: 'player_ready',
        gameId: this._gameId,
        userId: this._currentUser.id,
        isHost: this._isHost
      });
    });
  }

  handleWebSocketMessage(data) {
    if (data.type === 'player_ready') {
      // Un autre joueur est prêt, on peut démarrer la connexion P2P
      if (this._isHost && !this._peer)
        this.initializeWebRTC();
    } else if (data.type === 'webrtc_signal') {
      this.handleWebRTCSignal(data.signal);
    } else if (data.type === 'player_disconnected') {
      this.handlePlayerDisconnected(data.user_id);
    }
  }

  handleWebSocketClose(event) {
    logger.warn('WebSocket connection closed', event);
    if (event.code === 4004)
      logger.error('Invalid game ID provided for WebSocket connection');
    this.destroy();
  }

  handlePlayerDisconnected(userId) {
    logger.warn(`Player ${userId} disconnected`);
    // Gérer la déconnexion du joueur (pause, fin de partie, etc.)
    this.destroy();
  }

  setupGameControls() {
    logger.info('Setting up game controls');
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  handleKeyDown(e) {
    if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }

    logger.debug(`Key pressed: ${e.key}`);

    if (!this._isConnected) {
      logger.debug('Not connected, ignoring key press');
      return;
    }

    const paddleMove = {
      type: 'paddle_move',
      direction: null,
      timestamp: Date.now()
    };

    if (this._isHost) {
      if (e.key === 'w') paddleMove.direction = 'up';
      if (e.key === 's') paddleMove.direction = 'down';
    } else {
      if (e.key === 'ArrowUp') paddleMove.direction = 'up';
      if (e.key === 'ArrowDown') paddleMove.direction = 'down';
    }

    if (paddleMove.direction) {
      logger.debug(`Sending paddle move: ${paddleMove.direction}`);
      this.sendGameMessage(paddleMove);
      this.updatePaddleMovement(paddleMove);
    }
  }

  handleKeyUp(e) {
    if (!this._isConnected) return;

    const paddleStop = {
      type: 'paddle_stop',
      timestamp: Date.now()
    };

    if ((this._isHost && (e.key === 'w' || e.key === 's')) ||
      (!this._isHost && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) {
      this.sendGameMessage(paddleStop);
      this.stopPaddleMovement();
    }
  }

  updatePaddleMovement(data) {
    const paddle = this._isHost ? this._gameState.leftPaddle : this._gameState.rightPaddle;
    paddle.dy = data.direction === 'up' ? -2 : 2;
  }

  stopPaddleMovement() {
    const paddle = this._isHost ? this._gameState.leftPaddle : this._gameState.rightPaddle;
    paddle.dy = 0;
  }

  startGameLoop() {
    if (!this._gameLoopStarted) {
      this._gameLoopStarted = true;
      this.gameLoop();
    }
  }

  gameLoop() {
    if (this._isHost) {
      this.updateGameLogic();
    }
    this.drawGame();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  updateGameLogic() {
    // Mise à jour de la position des raquettes
    this.updatePaddle(this._gameState.leftPaddle);
    this.updatePaddle(this._gameState.rightPaddle);

    // Mise à jour de la balle
    this.updateBall();

    // Envoyer l'état du jeu à l'autre joueur
    this.sendGameMessage({
      type: 'game_state',
      state: this._gameState,
      timestamp: Date.now()
    });
  }

  updatePaddle(paddle) {
    paddle.y += paddle.dy;
    // Limites de la raquette
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y + paddle.height > this.canvas.height) {
      paddle.y = this.canvas.height - paddle.height;
    }
  }

  updateBall() {
    const ball = this._gameState.ball;
    if (ball.resetting) return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Collisions avec les murs
    if (ball.y <= 0 || ball.y + ball.height >= this.canvas.height) {
      ball.dy *= -1;
    }

    // Collisions avec les raquettes
    if (this.checkPaddleCollision(ball, this._gameState.leftPaddle) ||
      this.checkPaddleCollision(ball, this._gameState.rightPaddle)) {
      ball.dx *= -1;
    }

    // Point marqué
    if (ball.x < 0 || ball.x > this.canvas.width) {
      if (ball.x < 0) {
        this._gameState.rightScore++;
      } else {
        this._gameState.leftScore++;
      }

      // Vérifier la fin de partie
      if (this._gameState.leftScore >= 11 || this._gameState.rightScore >= 11) {
        this.handleGameEnd();
        return;
      }

      this.resetBall();
    }
  }

  checkPaddleCollision(ball, paddle) {
    return (
      ball.x < paddle.x + paddle.width &&
      ball.x + ball.width > paddle.x &&
      ball.y < paddle.y + paddle.height &&
      ball.y + ball.height > paddle.y
    );
  }

  resetBall() {
    const ball = this._gameState.ball;
    ball.resetting = true;
    ball.x = this.canvas.width / 2;
    ball.y = this.canvas.height / 2;
    ball.dx = 2 * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = 2 * (Math.random() > 0.5 ? 1 : -1);

    setTimeout(() => {
      ball.resetting = false;
    }, 1000);
  }

  drawGame() {
    this.bufferContext.fillStyle = '#000';
    this.bufferContext.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw paddles
    this.bufferContext.fillStyle = '#fff';
    this.drawPaddle(this._gameState.leftPaddle);
    this.drawPaddle(this._gameState.rightPaddle);

    // Draw ball
    this.bufferContext.fillStyle = '#fff';
    this.drawBall(this._gameState.ball);

    if (this._useWebGL && this.webglConsole)
      this.webglConsole.updateWebGLTexture(this.bufferCanvas);
    else
      this.context.drawImage(this.bufferCanvas, 0, 0);
  }

  drawPaddle(paddle) {
    this.bufferContext.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  }

  drawBall(ball) {
    this.bufferContext.fillRect(ball.x, ball.y, ball.width, ball.height);
  }

  async initializeWebRTC() {
    try {
      if (this._peer) {
        this._peer.close();
      }

      this._pendingCandidates = [];
      this._isICEGatheringComplete = false;
      this._hasRemoteDescription = false;

      this._peer = new RTCPeerConnection(this._rtcConfig);

      // Set up data channel
      if (this._isHost) {
        this._dataChannel = this._peer.createDataChannel('gameData', {
          ordered: true,
          maxRetransmits: 1
        });
        this.setupDataChannel();
      } else {
        this._peer.ondatachannel = (event) => {
          this._dataChannel = event.channel;
          this.setupDataChannel();
        };
      }

      // Enhanced ICE candidate handling
      this._peer.onicecandidate = (event) => {
        if (event.candidate) {
          this.wsService.send('pongGame', {
            type: 'webrtc_signal',
            signal: {
              type: 'ice_candidate',
              candidate: event.candidate
            }
          });
        }
      };

      this._peer.onicegatheringstatechange = () => {
        logger.info(`ICE gathering state: ${this._peer.iceGatheringState}`);
        if (this._peer.iceGatheringState === 'complete') {
          this._isICEGatheringComplete = true;
          this.processPendingCandidates();
        }
      };

      this._peer.oniceconnectionstatechange = () => {
        logger.info(`ICE connection state: ${this._peer.iceConnectionState}`);
        if (this._peer.iceConnectionState === 'failed') {
          this.handleICEFailure();
        }
      };

      this._peer.onconnectionstatechange = () => {
        logger.info(`WebRTC connection state changed to: ${this._peer.connectionState}`);
        if (this._peer.connectionState === 'failed') {
          this.handleConnectionFailure();
        }
      };

      // Create and send offer if host
      if (this._isHost) {
        const offer = await this._peer.createOffer({
          iceRestart: true,
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        });
        await this._peer.setLocalDescription(offer);
        this.wsService.send('pongGame', {
          type: 'webrtc_signal',
          signal: {
            type: 'offer',
            sdp: offer
          }
        });
      }
    } catch (error) {
      logger.error('WebRTC initialization error:', error);
      throw error;
    }
  }

  setupDataChannel() {
    this._dataChannel.onopen = () => {
      logger.info('P2P data channel opened');
      this._isConnected = true;
      this.startGameLoop();
    };

    this._dataChannel.onclose = () => {
      logger.info('P2P data channel closed');
      this._isConnected = false;
    };

    this._dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleGameMessage(data);
      } catch (error) {
        logger.error('Error processing data channel message:', error);
      }
    };

    // Add error handler
    this._dataChannel.onerror = (error) => {
      logger.error('Data channel error:', error);
      // Implement fallback strategy if needed
    };
  }

  async handleWebRTCSignal(signal) {
    try {
      if (!this._peer) {
        logger.error('Received WebRTC signal but peer connection not initialized');
        return;
      }

      if (signal.type === 'offer') {
        if (!this._isHost && this._peer.signalingState === 'stable') {
          await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          this._hasRemoteDescription = true;
          this.processPendingCandidates();

          const answer = await this._peer.createAnswer();
          await this._peer.setLocalDescription(answer);
          this.wsService.send('pongGame', {
            type: 'webrtc_signal',
            signal: {
              type: 'answer',
              sdp: answer
            }
          });
        }
      }
      else if (signal.type === 'answer') {
        if (this._isHost && this._peer.signalingState === 'have-local-offer') {
          await this._peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          this._hasRemoteDescription = true;
          this.processPendingCandidates();
        }
      }
      else if (signal.type === 'ice_candidate') {
        await this.handleICECandidate(signal.candidate);
      }
    } catch (error) {
      logger.error('Error handling WebRTC signal:', error);
      await this.handleSignalingError(error);
    }
  }

  async handleICECandidate(candidate) {
    if (!this._hasRemoteDescription) {
      // Store candidate for later if remote description isn't set yet
      this._pendingCandidates.push(candidate);
      return;
    }

    try {
      await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      logger.warn('Error adding ICE candidate:', error);
      // Don't throw - just log the error and continue
    }
  }

  async processPendingCandidates() {
    if (!this._hasRemoteDescription) return;

    while (this._pendingCandidates.length > 0) {
      const candidate = this._pendingCandidates.shift();
      try {
        await this._peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        logger.warn('Error adding pending ICE candidate:', error);
      }
    }
  }

  async handleICEFailure() {
    logger.warn('ICE connection failed, attempting ICE restart');

    if (this._isHost) {
      try {
        const offer = await this._peer.createOffer({ iceRestart: true });
        await this._peer.setLocalDescription(offer);
        this.wsService.send('pongGame', {
          type: 'webrtc_signal',
          signal: {
            type: 'offer',
            sdp: offer
          }
        });
      } catch (error) {
        logger.error('ICE restart failed:', error);
        await this.handleConnectionFailure();
      }
    }
  }

  async handleSignalingError(error) {
    logger.warn('Attempting to recover from signaling error:', error);

    if (this._peer.signalingState !== 'stable') {
      try {
        // Reset the connection if it's in an unstable state
        await this._peer.setLocalDescription({ type: "rollback" });
        logger.info('Successfully rolled back signaling state');

        // Reinitialize the connection
        await this.initializeWebRTC();
      } catch (recoveryError) {
        logger.error('Failed to recover from signaling error:', recoveryError);
        // If recovery fails, destroy and recreate the connection
        this.destroy();
        await this.connect();
      }
    }
  }

  checkConnectionState() {
    if (!this._peer) {
      logger.error('Peer connection not initialized');
      return false;
    }

    const state = this._peer.connectionState;
    if (state === 'failed' || state === 'closed') {
      logger.error(`WebRTC connection in invalid state: ${state}`);
      // Implement fallback to WebSocket if needed
      this._isConnected = false;
      return false;
    }

    return true;
  }

  // Utiliser cette vérification dans les méthodes critiques
  sendGameMessage(message) {
    if (!this.checkConnectionState()) return;

    // Add sequence number to game state messages
    if (message.type === 'game_state') {
      message.sequenceNumber = ++this._stateSequenceNumber;
    }

    // Use WebRTC data channel for game state if available
    if (this._useWebRTC && this._dataChannel && this._dataChannel.readyState === 'open') {
      this._dataChannel.send(JSON.stringify(message));
    } else {
      this.wsService.send('pongGame', message);
    }
  }

  handleGameMessage(message) {
    const latency = Date.now() - message.timestamp;
    if (latency > 100) {
      logger.warn(`High latency detected: ${latency}ms`);
    }

    switch (message.type) {
      case 'game_state':
        this.updateGameState(message.state);
        break;
      case 'paddle_move':
        this.updatePaddleMovement(message);
        break;
      case 'paddle_stop':
        this.stopPaddleMovement(message);
        break;
    }
  }

  updateGameState(state) {
    if (!state || !state.leftPaddle || !state.rightPaddle || !state.ball) {
      logger.error('Invalid game state received');
      return;
    }

    // Buffer states and process them in order
    this._stateBuffer.push({
      timestamp: state.timestamp,
      sequenceNumber: state.sequenceNumber,
      state: state
    });

    // Sort buffer by sequence number
    this._stateBuffer.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Process states in order
    while (this._stateBuffer.length > 0) {
      const nextState = this._stateBuffer[0];

      // Skip outdated states
      if (nextState.sequenceNumber <= this._lastProcessedStateTimestamp) {
        this._stateBuffer.shift();
        continue;
      }

      // Apply state and remove from buffer
      this._gameState = this.reconcileGameState(nextState.state);
      this._lastProcessedStateTimestamp = nextState.sequenceNumber;
      this._stateBuffer.shift();
    }

    // Cleanup old states (keep last 2 seconds)
    const twoSecondsAgo = Date.now() - 2000;
    this._stateBuffer = this._stateBuffer.filter(s => s.timestamp > twoSecondsAgo);

    this.drawGame();
  }

  reconcileGameState(receivedState) {
    // If this is the first state or we're the guest, just accept it
    if (!this._lastConfirmedState || !this._isHost) {
      this._lastConfirmedState = receivedState;
      return receivedState;
    }

    // Calculate interpolated state for smooth transitions
    const interpolatedState = {
      leftPaddle: this.interpolateObject(this._lastConfirmedState.leftPaddle, receivedState.leftPaddle),
      rightPaddle: this.interpolateObject(this._lastConfirmedState.rightPaddle, receivedState.rightPaddle),
      ball: this.interpolateObject(this._lastConfirmedState.ball, receivedState.ball),
      leftScore: receivedState.leftScore,
      rightScore: receivedState.rightScore
    };

    this._lastConfirmedState = receivedState;
    return interpolatedState;
  }

  interpolateObject(oldObj, newObj) {
    const result = {};
    for (const key in oldObj) {
      if (typeof oldObj[key] === 'number') {
        // Smooth transition between old and new values
        result[key] = oldObj[key] + (newObj[key] - oldObj[key]) * 0.5;
      } else {
        result[key] = newObj[key];
      }
    }
    return result;
  }

  destroy() {
    this._gameLoopStarted = false;
    if (this.webglConsole) {
      this.webglConsole = null;
    }
    if (this._peer) {
      this._peer.close();
      this._peer = null;
    }
    if (this._dataChannel) {
      this._dataChannel.close();
      this._dataChannel = null;
    }
    if (this.wsService) {
      this.wsService.destroy('pongGame');
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  handleGameEnd() {
    // Notifier le serveur de la fin de partie
    this.wsService.send('pongGame', {
      type: 'game_end',
      scores: {
        leftScore: this._gameState.leftScore,
        rightScore: this._gameState.rightScore
      }
    });

    // Arrêter la boucle de jeu
    this._gameLoopStarted = false;
  }

  async handleConnectionFailure() {
    logger.warn('WebRTC connection failed, switching to WebSocket fallback');

    // Close existing WebRTC connections
    if (this._dataChannel) {
      this._dataChannel.close();
    }
    if (this._peer) {
      this._peer.close();
    }

    // Switch to WebSocket-only mode
    this._useWebRTC = false;
    this._isConnected = false;

    // Reinitialize WebSocket connection if needed
    if (!this.wsService.isConnected('pongGame')) {
      this.initializeWebSocket();
    }

    // Start game loop using WebSocket
    this.startGameLoop();
  }
}