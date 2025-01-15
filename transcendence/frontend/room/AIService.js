// TODO : TO Remove workaround for AI Manager to review

import logger from '../logger.js';

export class AIService {
	static async loadAvailableModels() {
		try {
			const response = await fetch('/ai/list-saved-ai');
			if (!response.ok) {
				throw new Error('Failed to fetch AI models');
			}
			return await response.json();
		} catch (error) {
			logger.error('Error loading AI models:', error);
			// Return default models if fetch fails
			return {
				saved_ai: ['Easy', 'Medium', 'Hard']
			};
		}
	}

	static async updateAIModelSelect(selectElement) {
		try {
			const data = await this.loadAvailableModels();
			if (selectElement) {
				selectElement.innerHTML = data.saved_ai
					.map(model => `<option value="${model}">${model}</option>`)
					.join('');
			}
		} catch (error) {
			logger.error('Error updating AI model select:', error);
		}
	}
} 