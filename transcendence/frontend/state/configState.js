export const initialConfigState = {
	debug: false,
	logLevel: 'ERROR',
	rtc: {
		stunUrl: '',
		turnUrl1: '',
		turnUrl2: '',
		turnUsername: '',
		turnCredential: '',
	},
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
	rtc: (value) => typeof value === 'object' && value !== null,
	api: (value) => typeof value === 'object' && value !== null,
};
