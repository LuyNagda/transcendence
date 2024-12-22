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

	initialize() {
		const bodyElement = document.body;
		this.debugSettings = bodyElement.dataset.debug === 'True';
		this.logLevel = bodyElement.dataset.logLevel || 'ERROR';
		this.currentLevel = this.levels[this.logLevel.toUpperCase()] || this.levels['ERROR'];
		this.initialized = true;
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
		if (this.debugSettings && this.levels[level.toUpperCase()] >= this.currentLevel) {
			console[level.toLowerCase()](...messages);

			// Show stack trace for WARN levels - missing in console
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