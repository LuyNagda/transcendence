import logger from '../logger.js';
import { WebSocketConnection, WebRTCConnection, ConnectionState } from './NetworkingCore.js';

/**
 * Factory object for creating different types of network connections
 */
const ConnectionFactory = {
	websocket: (name, config) => new WebSocketConnection(name, config.endpoint, config.options),
	webrtc: (name, config) => new WebRTCConnection(name, config.rtcConfig)
};

/**
 * Manages creation and lifecycle of network connections
 * Provides a facade for working with WebSocket and WebRTC connections
 */
export class ConnectionManager {
	constructor() {
		this._connections = new Map(); // Individual connections
		this._connectionGroups = new Map(); // Groups of related connections
	}

	/**
	 * Creates a new connection of specified type
	 * @param {string} type - Connection type ('websocket' or 'webrtc')
	 * @param {string} name - Unique identifier for the connection
	 * @param {Object} config - Connection configuration
	 * @returns {BaseConnection} The created connection instance
	 */
	createConnection(type, name, config) {
		if (this._connections.has(name)) {
			logger.warn(`Connection ${name} already exists`);
			return this._connections.get(name);
		}

		const factory = ConnectionFactory[type];
		if (!factory) throw new Error(`Unknown connection type: ${type}`);

		const connection = factory(name, config);
		this._connections.set(name, connection);
		connection.on('stateChange', (state) => {
			logger.debug(`Connection ${name} state changed to ${state.name}`);
			this._handleStateChange(name, state);
		});

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
		for (const [name, config] of Object.entries(connections)) {
			const connection = this.createConnection(config.type, `${groupName}:${name}`, config.config);
			group.set(name, connection);
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
			await Promise.all(Array.from(group.values()).map(conn => conn.connect()));
			return true;
		} catch (error) {
			logger.error(`Error connecting group ${groupName}:`, error);
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
	 * Handles connection state changes and emits events
	 * @private
	 */
	_handleStateChange(name, state) {
		this.emit('connectionStateChange', { name, state });
		if (state === ConnectionState.ERROR) {
			logger.error(`Connection ${name} entered error state`);
		}
	}

	/**
	 * Emits events for external monitoring
	 * @private
	 */
	emit(event, data) {
		logger.debug(`ConnectionManager event: ${event}`, data);
	}
}