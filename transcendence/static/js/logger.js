'use strict';
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
		if (this.levels[level.toUpperCase()] >= this.currentLevel) {
			console[level.toLowerCase()](...messages);
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

// Create a global logger instance
window.logger = new Logger();

// Initialize the logger when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
	window.logger.initialize();
});