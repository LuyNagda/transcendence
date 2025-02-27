import logger from '../logger.js';
import { WebSocketConnection } from './WebsocketConnection.js';
import { WebRTCConnection } from './WebRTCConnection.js';
import { store } from '../state/store.js';

/**
 * Factory object for creating different types of network connections
 */
const ConnectionFactory = {
	websocket: (name, config) => new WebSocketConnection(name, config.endpoint, config.options),
	webrtc: (name, config) => new WebRTCConnection(name, config.rtcConfig)
};

/**
 * Singleton manager for all network connections in the application
 */
class ConnectionManager {
	constructor() {
		if (ConnectionManager._instance) return ConnectionManager._instance;
		ConnectionManager._instance = this;

		this._connections = new Map();
		this._connectionGroups = new Map();
		this._initialized = false;
	}

	/**
	 * Initializes the connection manager with default configurations
	 * @param {Object} config Optional configuration object
	 */
	initialize() {
		if (this._initialized) {
			logger.warn('[ConnectionManager] already initialized');
			return;
		}

		const config = store.getState('config');
		this._rtcDefaultConfig = {
			iceServers: [
				{
					urls: config.rtc?.stunUrl || 'stun:127.0.0.1:3478'
				},
				{
					urls: [
						config.rtc?.turnUrl1 || 'turn:127.0.0.1:3478',
						config.rtc?.turnUrl2 || 'turn:127.0.0.1:5349'
					],
					username: config.rtc?.turnUsername || 'transcendence',
					credential: config.rtc?.turnCredential || 'transcendence123'
				}
			],
			iceTransportPolicy: 'all',
			iceCandidatePoolSize: 0,
			bundlePolicy: 'balanced',
			rtcpMuxPolicy: 'require',
			iceServersPolicy: 'all'
		};

		this._initialized = true;

		logger.debug('[ConnectionManager] ICE server configuration:', this._rtcDefaultConfig);
	}

	/**
	 * Creates a new connection of specified type
	 * @param {string} type - Connection type ('websocket' or 'webrtc')
	 * @param {string} name - Unique identifier for the connection
	 * @param {Object} config - Connection configuration
	 * @returns {BaseConnection} The created connection instance
	 */
	createConnection(type, name, config) {
		this._checkInitialized();

		if (this._connections.has(name)) {
			logger.warn(`[ConnectionManager] Connection ${name} already exists`);
			return this._connections.get(name);
		}

		const factory = ConnectionFactory[type];
		if (!factory) throw new Error(`Unknown connection type: ${type}`);

		// For WebRTC connections, merge with default config
		if (type === 'webrtc') {
			config.rtcConfig = config.rtcConfig ? {
				...this._rtcDefaultConfig,
				...config.rtcConfig,
				isHost: config.isHost
			} : {
				...this._rtcDefaultConfig,
				isHost: config.isHost
			};
		}

		logger.info('[ConnectionManager] Creating connection', { type, name, config });

		const connection = factory(name, config);
		this._connections.set(name, connection);

		// Set up common event logging
		connection.on('stateChange', (state) => {
			logger.info(`[ConnectionManager] Connection ${name} state changed to ${state.name}`);
		});

		// Set up WebRTC-specific event handling
		if (type === 'webrtc') {
			connection.on('iceConnectionStateChange', (state) => {
				logger.debug(`[ConnectionManager] Connection ${name} ICE state: ${state}`);
			});

			connection.on('iceGatheringComplete', () => {
				logger.debug(`[ConnectionManager] Connection ${name} ICE gathering complete`);
			});

			connection.on('iceTimeout', () => {
				logger.warn(`[ConnectionManager] Connection ${name} ICE negotiation timeout`);
			});

			connection.on('iceRestartNeeded', () => {
				logger.warn(`[ConnectionManager] Connection ${name} ICE restart needed`);
				// The connection will handle the restart internally
			});
		}

		return connection;
	}

	/**
	 * Creates a group of related connections
	 * @param {string} groupName - Name for the connection group
	 * @param {Object} connections - Configuration for each connection in group
	 * @returns {Map} Map of created connections
	 */
	createConnectionGroup(groupName, connections) {
		const group = new Map();

		// Create all connections in the group
		for (const [name, config] of Object.entries(connections)) {
			const connectionName = `${groupName}:${name}`;
			const connection = this.createConnection(config.type, connectionName, config.config);
			group.set(name, connection);
		}

		// Set up WebRTC signal relay if both WebSocket and WebRTC are in the group
		const wsConnection = Array.from(group.entries())
			.find(([_, conn]) => conn instanceof WebSocketConnection);
		const rtcConnection = Array.from(group.entries())
			.find(([_, conn]) => conn instanceof WebRTCConnection);

		if (wsConnection && rtcConnection) {
			const [wsName, ws] = wsConnection;
			const [rtcName, rtc] = rtcConnection;

			// Set up automatic signal relay from WebRTC to WebSocket
			rtc.on('signal', (signal) => {
				logger.debug(`[ConnectionManager] Relaying WebRTC signal from ${rtcName} through ${wsName}`);
				if (ws.state.canSend) {
					ws.send({
						type: 'webrtc_signal',
						signal: signal
					});
				} else {
					logger.warn(`[ConnectionManager] Cannot relay signal - WebSocket not ready`);
				}
			});
		}

		this._connectionGroups.set(groupName, group);
		return group;
	}

	// Connection retrieval methods
	getConnection(name) { return this._connections.get(name); }
	getConnectionGroup(groupName) { return this._connectionGroups.get(groupName); }
	getConnectionState(name) {
		const connection = this._connections.get(name);
		return connection ? connection.state : null;
	}

	/**
	 * Gets states of all connections in a group
	 * @param {string} groupName - Name of connection group
	 * @returns {Object|null} States of connections in group
	 */
	getGroupState(groupName) {
		const group = this._connectionGroups.get(groupName);
		if (!group) return null;

		const states = {};
		group.forEach((connection, name) => states[name] = connection.state);
		return states;
	}

	// Connection cleanup methods
	removeConnection(name) {
		const connection = this._connections.get(name);
		if (connection) {
			connection.disconnect();
			this._connections.delete(name);
		}
	}

	removeConnectionGroup(groupName) {
		const group = this._connectionGroups.get(groupName);
		if (group) {
			group.forEach(connection => connection.disconnect());
			this._connectionGroups.delete(groupName);
		}
	}

	/**
	 * Connects all connections in a group
	 * @param {string} groupName - Name of connection group
	 * @returns {Promise<boolean>} Success status
	 */
	async connectGroup(groupName) {
		const group = this._connectionGroups.get(groupName);
		if (!group) return false;

		try {
			// Connect WebSocket connections first
			const wsConnections = Array.from(group.entries())
				.filter(([_, conn]) => conn instanceof WebSocketConnection)
				.map(([_, conn]) => conn);

			if (wsConnections.length > 0) {
				await Promise.all(wsConnections.map(conn => conn.connect()));
			}

			// Then connect WebRTC connections
			const rtcConnections = Array.from(group.entries())
				.filter(([_, conn]) => conn instanceof WebRTCConnection)
				.map(([_, conn]) => conn);

			if (rtcConnections.length > 0) {
				await Promise.all(rtcConnections.map(conn => conn.connect()));
			}

			return true;
		} catch (error) {
			logger.error(`[ConnectionManager] Error connecting group ${groupName}:`, error);
			return false;
		}
	}

	/**
	 * Handles WebRTC signaling for a connection group
	 * @param {string} groupName - Name of the connection group
	 * @param {Object} signal - WebRTC signaling data
	 * @returns {Promise<boolean>} Success status
	 */
	async handleWebRTCSignal(groupName, signal) {
		const group = this._connectionGroups.get(groupName);
		if (!group) {
			logger.warn(`[ConnectionManager] Cannot handle signal - group ${groupName} not found`);
			return false;
		}

		// Find the WebRTC connection in the group
		const rtcConnection = Array.from(group.values())
			.find(conn => conn instanceof WebRTCConnection);

		if (!rtcConnection) {
			logger.warn(`[ConnectionManager] No WebRTC connection in group ${groupName}`);
			return false;
		}

		try {
			if (signal.type === 'offer') {
				logger.debug(`[ConnectionManager] Handling offer for ${groupName}${signal.iceRestart ? ' (ICE restart)' : ''}`);
				logger.debug(`Offer SDP: ${signal.sdp.substring(0, 100)}...`); // Log the first part of the SDP for debugging
				await rtcConnection.handleOffer({
					type: 'offer',
					sdp: signal.sdp,
					iceRestart: signal.iceRestart
				});
				return true;
			} else if (signal.type === 'answer') {
				logger.debug(`[ConnectionManager] Handling answer for ${groupName}`);
				logger.debug(`Answer SDP: ${signal.sdp.substring(0, 100)}...`); // Log the first part of the SDP for debugging
				await rtcConnection.handleAnswer({
					type: 'answer',
					sdp: signal.sdp
				});
				return true;
			} else if (signal.type === 'candidate') {
				logger.debug(`[ConnectionManager] Received ICE candidate for ${groupName}: ${signal.candidate.type} - ${signal.candidate.protocol}`);
				if (signal.candidate) await rtcConnection.addIceCandidate(signal.candidate);
				return true;
			} else if (signal.type === 'iceRestart') {
				logger.debug(`[ConnectionManager] Handling ICE restart request for ${groupName}`);
				// This will trigger the WebRTC connection to create a new offer with ICE restart
				rtcConnection.emit('iceRestartNeeded');
				return true;
			} else {
				logger.warn(`[ConnectionManager] Unknown or malformed signal type: ${signal.type}`, signal);
				return false;
			}
		} catch (error) {
			logger.error(`[ConnectionManager] Error handling WebRTC signal:`, error);
			return false;
		}
	}

	// Group disconnection methods
	disconnectGroup(groupName) {
		const group = this._connectionGroups.get(groupName);
		if (group) group.forEach(connection => connection.disconnect());
	}

	disconnectAll() {
		this._connections.forEach(connection => connection.disconnect());
		this._connectionGroups.forEach(group => group.forEach(connection => connection.disconnect()));
		this._connections.clear();
		this._connectionGroups.clear();
	}

	/**
	 * Ensures the manager is initialized before use
	 * @private
	 */
	_checkInitialized() {
		if (!this._initialized) {
			throw new Error('ConnectionManager must be initialized before use');
		}
	}

	/**
	 * Cleans up all connections and resets the manager
	 */
	destroy() {
		this.disconnectAll();
		this._initialized = false;
	}
}

// Export singleton instance
export const connectionManager = new ConnectionManager();