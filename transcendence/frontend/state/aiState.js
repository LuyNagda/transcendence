export const aiActions = {
	START_TRAINING: 'START_TRAINING',
	END_TRAINING: 'END_TRAINING'
};

export const initialAiState = {
	trainingInProgress: false
};

export const aiValidators = {
	trainingInProgress: (value) => typeof value === 'boolean'
};

export const aiReducers = {
	[aiActions.START_TRAINING]: (state) => {
		return {
			...state,
			trainingInProgress: true
		};
	},

	[aiActions.END_TRAINING]: (state) => {
		return {
			...state,
			trainingInProgress: false
		};
	}
};
