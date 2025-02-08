// Log levels
const LogLevel = {
	DEBUG: 10,
	INFO: 20,
	WARN: 30,
	ERROR: 40
};

// Default configuration
const defaultConfig = {
	debug: false,
	logLevel: 'INFO',
	currentLevel: LogLevel.INFO
};

class Logger {
	constructor() {
		this.config = { ...defaultConfig };
	}

	initialize(config = {}) {
		this.config = {
			...defaultConfig,
			...config,
			currentLevel: LogLevel[config.logLevel || defaultConfig.logLevel]
		};
		if (config.debug)
			console.log('Logger initialized with:', this.config);
	}

	_shouldLog(level) {
		return this.config.debug && LogLevel[level] >= this.config.currentLevel;
	}

	_formatMessage(level, message, ...args) {
		const timestamp = new Date().toISOString();
		return `[${level}] ${message}`;
	}

	debug(message, ...args) {
		if (this._shouldLog('DEBUG')) {
			console.debug(this._formatMessage('DEBUG', message), ...args);
		}
	}

	info(message, ...args) {
		if (this._shouldLog('INFO')) {
			console.info(this._formatMessage('INFO', message), ...args);
		}
	}

	warn(message, ...args) {
		if (this._shouldLog('WARN')) {
			console.warn(this._formatMessage('WARN', message), ...args);
		}
	}

	error(message, ...args) {
		if (this._shouldLog('ERROR')) {
			console.error(this._formatMessage('ERROR', message), ...args);
		}
	}
}

// Create and export singleton instance
const logger = new Logger();
export default logger;