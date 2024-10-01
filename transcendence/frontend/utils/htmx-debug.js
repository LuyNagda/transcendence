import { logger } from './logger.js';

export function initializeErrorHandling() {
	window.onerror = function (message, source, lineno, colno, error) {
		logger.error('Global error:', { message, source, lineno, colno, error });
		return false;
	};

	window.addEventListener('unhandledrejection', function (event) {
		logger.error('Unhandled promise rejection:', event.reason);
	});
}

export function initializeHtmxLogging() {
	document.body.addEventListener('htmx:configRequest', function (event) {
		logger.debug('HTMX request configured:', event.detail);
	});

	document.body.addEventListener('htmx:beforeRequest', function (event) {
		logger.debug('HTMX request started:', event.detail);
	});

	document.body.addEventListener('htmx:afterRequest', function (event) {
		logger.debug('HTMX request completed:', event.detail);
	});

	document.body.addEventListener('htmx:responseError', function (event) {
		logger.error('HTMX response error:', event.detail);
	});

	document.body.addEventListener('htmx:afterSettle', function (event) {
		logger.debug('HTMX after settle:', event.detail);
	});
}