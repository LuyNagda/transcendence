export const initialConfigState = {
	debug: false,
	logLevel: 'ERROR',
	api: {
		baseUrl: '',
		timeout: 5000,
	}
};

export const configActions = {
	INITIALIZE: 'INITIALIZE',
};

export const configReducers = {
	[configActions.INITIALIZE]: (state, payload) => ({
		...initialConfigState,
		...payload
	}),
};

export const configValidators = {
	debug: (value) => typeof value === 'boolean',
	logLevel: (value) => typeof value === 'string',
	api: (value) => typeof value === 'object' && value !== null,
	game: (value) => typeof value === 'object' && value !== null,
};
