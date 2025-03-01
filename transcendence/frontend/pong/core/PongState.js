import logger from '../../logger.js';
import { store } from '../../state/store.js';
import { SettingsManager } from './SettingsManager.js';

export class PongPhysics {
  /**
   * Creates a new PongPhysics instance
   * @param {EventEmitter} eventEmitter - The event emitter for communication
   * @param {Object} settings - Game settings
   */
  constructor(eventEmitter, settings) {
    this.eventEmitter = eventEmitter;
    this.settingsManager = new SettingsManager(settings || {});
    this.physicsState = this._initializeState();
    this.lastUpdateTime = Date.now();
    this._setupEventListeners();
    store.subscribe('game', this._handleGameStateChange.bind(this));

    logger.info('PongPhysics initialized with state:', {
      gameStatus: this.physicsState.gameStatus,
      ballPosition: {
        x: this.physicsState.ball.x,
        y: this.physicsState.ball.y
      }
    });
  }

  /**
   * Initialize the physics state
   * @private
   * @returns {Object} - The initial physics state
   */
  _initializeState() {
    const canvasWidth = this.settingsManager.getCanvasWidth();
    const canvasHeight = this.settingsManager.getCanvasHeight();
    const paddleHeight = this.settingsManager.getPaddleHeight();
    const paddleWidth = this.settingsManager.getPaddleWidth();
    const ballRadius = this.settingsManager.getBallRadius();

    logger.debug('Initializing physics state with values:', {
      canvasWidth,
      canvasHeight,
      paddleWidth,
      paddleHeight,
      ballRadius,
    });

    // Get initial positions
    const initialBallPosition = this.settingsManager.getInitialBallPosition();
    const initialPaddlePositions = this.settingsManager.getInitialPaddlePositions();

    return {
      ball: {
        x: initialBallPosition.x,
        y: initialBallPosition.y,
        prevX: initialBallPosition.x,
        prevY: initialBallPosition.y,
        dx: 0,
        dy: 0,
        radius: ballRadius,
        resetting: false
      },
      leftPaddle: {
        x: initialPaddlePositions.left.x,
        y: initialPaddlePositions.left.y,
        prevY: initialPaddlePositions.left.y,
        width: paddleWidth,
        height: paddleHeight,
        dy: 0
      },
      rightPaddle: {
        x: initialPaddlePositions.right.x,
        y: initialPaddlePositions.right.y,
        prevY: initialPaddlePositions.right.y,
        width: paddleWidth,
        height: paddleHeight,
        dy: 0
      },
      scores: {
        left: 0,
        right: 0
      },
      lastScorer: null,
      gameStatus: 'waiting'
    };
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    this.eventEmitter.on('playerInput', this._handlePlayerInput.bind(this));
    this.eventEmitter.on('remotePhysicsUpdate', this._handleRemotePhysicsUpdate.bind(this));
    this.eventEmitter.on('gamePaused', () => this.physicsState.gameStatus = 'paused');
    this.eventEmitter.on('gameResumed', () => this.physicsState.gameStatus = 'playing');
    this.eventEmitter.on('gameDestroyed', () => { });
  }

  /**
   * Handle player input
   * @private
   * @param {Object} data - Input data
   */
  _handlePlayerInput(data) {
    const { player, input } = data;
    const paddleSpeed = this.settingsManager.getPaddleSpeed();

    if (player === 'left')
      this.physicsState.leftPaddle.dy = input.direction * input.intensity * paddleSpeed;
    else if (player === 'right')
      this.physicsState.rightPaddle.dy = input.direction * input.intensity * paddleSpeed;
  }

  /**
   * Handle remote physics updates (for non-host players)
   * @private
   * @param {Object} state - The remote physics state
   */
  _handleRemotePhysicsUpdate(state) {
    if (!this.isHost)
      this.applyAuthorityState(state);
  }

  /**
   * Handle game state changes from the store
   * @private
   * @param {Object} state - The new game state
   */
  _handleGameStateChange(state) {
    if (state.status && state.status !== this.physicsState.gameStatus) {
      logger.info(`Updating game status from ${this.physicsState.gameStatus} to ${state.status}`);
      this.physicsState.gameStatus = state.status;

      if (state.status === 'playing') {
        const canvasWidth = this.settingsManager.getCanvasWidth();
        const canvasHeight = this.settingsManager.getCanvasHeight();
        if (this.physicsState.ball.x < 0 || this.physicsState.ball.x > canvasWidth ||
          this.physicsState.ball.y < 0 || this.physicsState.ball.y > canvasHeight) {
          this.physicsState.ball.x = canvasWidth / 2;
          this.physicsState.ball.y = canvasHeight / 2;
        }
      }
    }
  }

  /**
   * Initialize the physics system
   * @returns {boolean} - Whether initialization was successful
   */
  initialize() {
    logger.info('Initializing physics system');
    return true;
  }

  /**
   * Update the physics state
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    if (Math.random() < 0.01) { // Log approximately 1% of frames
      logger.debug('PongPhysics update called:', {
        gameStatus: this.physicsState.gameStatus,
        deltaTime: deltaTime,
        ball: this.physicsState.ball ? {
          x: this.physicsState.ball.x.toFixed(2),
          y: this.physicsState.ball.y.toFixed(2),
          dx: this.physicsState.ball.dx.toFixed(2),
          dy: this.physicsState.ball.dy.toFixed(2)
        } : 'missing'
      });
    }

    // Only update if game is playing
    if (this.physicsState.gameStatus !== 'playing') {
      if (Math.random() < 0.01) { // Log occasionally
        logger.debug('PongPhysics update skipped - game not playing:', {
          gameStatus: this.physicsState.gameStatus
        });
      }
      return;
    }

    // Calculate delta time if not provided
    const now = Date.now();
    const dt = deltaTime || (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    this._updatePositions(dt);
    this._checkCollisions();

    // Get game state and check if this is a multiplayer game where we're not the host
    const gameState = store.getState('game');
    const isMultiplayerGuest = gameState && gameState.players &&
      gameState.players.length > 1 &&
      gameState.players.find(p => p.isLocal && !p.isHost);

    const scoringEvent = this._checkScoring();
    if (scoringEvent) {
      // In multiplayer games, only the host should process scoring events
      // Guests will receive score updates through network messages
      if (!isMultiplayerGuest) {
        this.physicsState.scores[scoringEvent.player]++;
        this.physicsState.lastScorer = scoringEvent.player;
        logger.debug(`Physics scoring event: ${scoringEvent.player} scored. Current scores: ${this.physicsState.scores.left}-${this.physicsState.scores.right}. ${isMultiplayerGuest ? '(Guest skipping score update)' : '(Processing score update)'}`);
        this.eventEmitter.emit('scorePoint', { player: scoringEvent.player });
      } else {
        logger.debug(`Physics scoring event as guest: ${scoringEvent.player} scored, but not processing score. Waiting for host update.`);
      }
      this._resetBall();
    }

    // Safety : If ball has gone too far off-screen, reset it
    const { ball } = this.physicsState;
    const maxAllowedDistance = this.settingsManager.getCanvasWidth() * 2; // Allow some leeway for ball to go off-screen before scoring

    if (Math.abs(ball.x) > maxAllowedDistance || Math.abs(ball.y) > maxAllowedDistance) {
      logger.warn('Ball position out of bounds, resetting:', {
        x: ball.x,
        y: ball.y,
        dx: ball.dx,
        dy: ball.dy
      });
      this._resetBall();
    }

    this.eventEmitter.emit('physicsUpdated', this.physicsState);
  }

  /**
   * Update positions based on velocities
   * @private
   * @param {number} dt - Delta time in seconds
   */
  _updatePositions(dt) {
    const { ball, leftPaddle, rightPaddle } = this.physicsState;
    const canvasHeight = this.settingsManager.getCanvasHeight();

    // Store previous positions
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    leftPaddle.prevY = leftPaddle.y;
    rightPaddle.prevY = rightPaddle.y;

    // Update positions
    ball.x += ball.dx * dt;
    ball.y += ball.dy * dt;
    leftPaddle.y += leftPaddle.dy * dt;
    rightPaddle.y += rightPaddle.dy * dt;

    // Clamp paddle positions to canvas boundaries
    leftPaddle.y = Math.max(0, Math.min(canvasHeight - leftPaddle.height, leftPaddle.y));
    rightPaddle.y = Math.max(0, Math.min(canvasHeight - rightPaddle.height, rightPaddle.y));
  }

  /**
   * Check for collisions
   * @private
   */
  _checkCollisions() {
    const { ball, leftPaddle, rightPaddle } = this.physicsState;
    const canvasHeight = this.settingsManager.getCanvasHeight();

    // Ball collision with top and bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvasHeight) {
      ball.dy = -ball.dy;

      if (ball.y - ball.radius < 0)
        ball.y = ball.radius;
      else
        ball.y = canvasHeight - ball.radius;
    }

    // Ball collision with left paddle
    // Check both current and previous positions to catch fast-moving balls
    if (ball.dx < 0 && // Only check when ball is moving left
      ((ball.x - ball.radius <= leftPaddle.x + leftPaddle.width && // Current position
        ball.y >= leftPaddle.y &&
        ball.y <= leftPaddle.y + leftPaddle.height) ||
        (ball.prevX - ball.radius > leftPaddle.x + leftPaddle.width && // Previous position (crossed through)
          ball.x - ball.radius < leftPaddle.x &&
          ball.y >= leftPaddle.y - ball.radius &&
          ball.y <= leftPaddle.y + leftPaddle.height + ball.radius))) {

      // Calculate normalized hit position (-0.5 to 0.5)
      const hitPosition = (ball.y - (leftPaddle.y + leftPaddle.height / 2)) / leftPaddle.height;

      // Reposition ball to avoid getting stuck
      ball.x = leftPaddle.x + leftPaddle.width + ball.radius;

      this._reflectBall(hitPosition, 'left');
    }

    // Ball collision with right paddle
    // Check both current and previous positions to catch fast-moving balls
    if (ball.dx > 0 && // Only check when ball is moving right
      ((ball.x + ball.radius >= rightPaddle.x && // Current position
        ball.y >= rightPaddle.y &&
        ball.y <= rightPaddle.y + rightPaddle.height) ||
        (ball.prevX + ball.radius < rightPaddle.x && // Previous position (crossed through)
          ball.x + ball.radius > rightPaddle.x + rightPaddle.width &&
          ball.y >= rightPaddle.y - ball.radius &&
          ball.y <= rightPaddle.y + rightPaddle.height + ball.radius))) {

      // Calculate normalized hit position (-0.5 to 0.5)
      const hitPosition = (ball.y - (rightPaddle.y + rightPaddle.height / 2)) / rightPaddle.height;

      // Reposition ball to avoid getting stuck
      ball.x = rightPaddle.x - ball.radius;

      this._reflectBall(hitPosition, 'right');
    }
  }

  /**
   * Reflect the ball with angle based on hit position
   * @private
   * @param {number} hitPosition - Normalized hit position (-0.5 to 0.5)
   * @param {string} side - Which paddle was hit ('left' or 'right')
   */
  _reflectBall(hitPosition, side) {
    const { ball } = this.physicsState;
    const maxBounceAngle = Math.PI / 4; // 45 degrees
    const bounceAngle = hitPosition * maxBounceAngle;
    const speed = this.settingsManager.getBallSpeed();
    const direction = side === 'left' ? 1 : -1;

    ball.dx = direction * speed * Math.cos(bounceAngle);
    ball.dy = speed * Math.sin(bounceAngle);
  }

  /**
   * Check for scoring
   * @private
   * @returns {Object|null} - Scoring event or null if no scoring
   */
  _checkScoring() {
    const { ball } = this.physicsState;
    const canvasWidth = this.settingsManager.getCanvasWidth();
    if (ball.x - ball.radius < 0) return { player: 'right' };
    if (ball.x + ball.radius > canvasWidth) return { player: 'left' };
    return null;
  }

  /**
   * Reset the ball for the next point
   * @private
   */
  _resetBall() {
    const { ball } = this.physicsState;
    const initialPosition = this.settingsManager.getInitialBallPosition();

    ball.x = initialPosition.x;
    ball.y = initialPosition.y;
    ball.prevX = initialPosition.x;
    ball.prevY = initialPosition.y;
    ball.dx = 0;
    ball.dy = 0;

    this.eventEmitter.emit('ballReadyForLaunch');
  }

  /**
   * Launch the ball with initial velocity
   */
  launchBall() {
    const { ball } = this.physicsState;
    if (ball.dx === 0 && ball.dy === 0) {
      logger.info('Launching ball from position:', {
        x: ball.x,
        y: ball.y,
        gameStatus: this.physicsState.gameStatus
      });

      const initialVelocity = this.settingsManager.getInitialBallVelocity();
      ball.dx = initialVelocity.dx;
      ball.dy = initialVelocity.dy;

      logger.info('Ball launched with velocity:', {
        dx: ball.dx.toFixed(2),
        dy: ball.dy.toFixed(2),
        speed: this.settingsManager.getBallSpeed().toFixed(2),
        direction: ball.dx > 0 ? 'right' : 'left'
      });
    }
  }

  /**
   * Apply the authoritative state from the host
   * @param {Object} authState - Authoritative state
   * @param {number} interpolationFactor - Base interpolation factor (0-1)
   */
  applyAuthorityState(authState, baseFactor = 0.3) {
    if (!authState) return;

    const { ball, leftPaddle, rightPaddle } = this.physicsState;

    // Adaptive interpolation based on distance
    // Apply higher interpolation for larger discrepancies to catch up faster
    if (authState.ball) {
      // Calculate distance between current and authority position
      const ballDist = Math.sqrt(
        Math.pow(authState.ball.x - ball.x, 2) +
        Math.pow(authState.ball.y - ball.y, 2)
      );

      // Increase interpolation factor based on distance
      // For small differences, use base factor, for larger ones, increase up to 0.8
      const ballFactor = Math.min(baseFactor + (ballDist / 100) * 0.5, 0.8);

      ball.x = ball.x + (authState.ball.x - ball.x) * ballFactor;
      ball.y = ball.y + (authState.ball.y - ball.y) * ballFactor;
      ball.dx = authState.ball.dx; // Use exact velocity to prevent accumulated drift
      ball.dy = authState.ball.dy; // Use exact velocity to prevent accumulated drift
    }

    // Interpolate paddle positions with adaptive factor
    if (authState.leftPaddle) {
      const leftDist = Math.abs(authState.leftPaddle.y - leftPaddle.y);
      const leftFactor = Math.min(baseFactor + (leftDist / 50) * 0.5, 0.8);
      leftPaddle.y = leftPaddle.y + (authState.leftPaddle.y - leftPaddle.y) * leftFactor;
    }

    if (authState.rightPaddle) {
      const rightDist = Math.abs(authState.rightPaddle.y - rightPaddle.y);
      const rightFactor = Math.min(baseFactor + (rightDist / 50) * 0.5, 0.8);
      rightPaddle.y = rightPaddle.y + (authState.rightPaddle.y - rightPaddle.y) * rightFactor;
    }
  }

  /**
   * Destroy the physics system
   */
  destroy() { }
} 