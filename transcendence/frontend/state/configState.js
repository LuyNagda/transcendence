export const initialConfigState = null;

export const configActions = {
	INITIALIZE: 'INITIALIZE',
};

export const configReducers = {
	[configActions.INITIALIZE]: (state, payload) => Object.freeze(payload),
};

export const configValidators = {
	config: (value) => value !== null && typeof value === 'object',
};
