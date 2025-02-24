// TODO : TO Remove workaround for AI Manager to review

import logger from '../logger.js';
import { store, actions } from '../state/store.js';

export class AIService {
	static async loadAvailableModels() {
		try {
			const response = await fetch('/ai/list-saved-ai');
			if (!response.ok) {
				throw new Error('Failed to fetch AI models');
			}
			const data = await response.json();
			await this.updateStoreWithAvailableAIs(data.saved_ai);
			return data;
		} catch (error) {
			logger.error('Error loading AI models:', error);
			// Return default models if fetch fails
			const defaultAIs = ['Easy', 'Medium', 'Hard'];
			await this.updateStoreWithAvailableAIs(defaultAIs);
			return {
				saved_ai: defaultAIs
			};
		}
	}

	static async updateStoreWithAvailableAIs(aiList) {
		if (!Array.isArray(aiList)) {
			logger.error('Invalid AI list format:', aiList);
			return;
		}

		store.dispatch({
			domain: 'room',
			type: actions.room.UPDATE_ROOM,
			payload: {
				availableAIs: aiList
			}
		});
		logger.debug('Updated store with available AIs:', aiList);
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