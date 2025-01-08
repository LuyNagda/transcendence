class Logger {
	constructor() {
		this.debugSettings = false;
		this.logLevel = 'ERROR';
		this.levels = {
			'DEBUG': 10,
			'INFO': 20,
			'WARN': 30,
			'ERROR': 40
		};
		this.currentLevel = this.levels['ERROR'];
		this.queue = [];
		this.initialized = false;
	}

	initialize(debug = false, logLevel = 'ERROR') {
		this.debugSettings = debug;
		this.logLevel = logLevel.toUpperCase();
		this.currentLevel = this.levels[this.logLevel] || this.levels['ERROR'];
		this.initialized = true;
		console.log('Logger initialized with:', {
			debug: this.debugSettings,
			logLevel: this.logLevel,
			currentLevel: this.currentLevel
		});
		this.processQueue();
	}

	processQueue() {
		while (this.queue.length > 0) {
			const { level, messages } = this.queue.shift();
			this.log(level, ...messages);
		}
	}

	log(level, ...messages) {
		if (!this.initialized) {
			this.queue.push({ level, messages });
			return;
		}

		const messageLevel = this.levels[level.toUpperCase()];

		// Simplified condition for better debugging
		if (messageLevel >= this.currentLevel) {
			if (this.debugSettings || messageLevel >= this.levels['ERROR']) {
				console[level.toLowerCase()](`[${level}]`, ...messages);

				// Show stack trace for WARN levels
				if (level === 'WARN') {
					const stack = new Error().stack
						.split('\n')
						.slice(2) // Skip "Error" and current "log" function
						.map(line => line.trim())
						.join('\n');

					console.groupCollapsed('Stack trace');
					console.log(stack);
					console.groupEnd();
				}
			}
		}
	}

	debug(...messages) {
		this.log('DEBUG', ...messages);
	}

	info(...messages) {
		this.log('INFO', ...messages);
	}

	warn(...messages) {
		this.log('WARN', ...messages);
	}

	error(...messages) {
		this.log('ERROR', ...messages);
	}
}

// Create and export a global logger instance
const logger = new Logger();
export default logger;