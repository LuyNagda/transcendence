export const uiActions = {
	INITIALIZE: 'INITIALIZE',
	SHOW_MODAL: 'SHOW_MODAL',
	HIDE_MODAL: 'HIDE_MODAL',
	SHOW_TOAST: 'SHOW_TOAST',
	HIDE_TOAST: 'HIDE_TOAST',
	TOGGLE_OFFCANVAS: 'TOGGLE_OFFCANVAS',
	UPDATE_THEME: 'UPDATE_THEME',
	UPDATE_FONT_SIZE: 'UPDATE_FONT_SIZE',
	UPDATE: 'UPDATE'
};

export const UI_THEME = {
	LIGHT: 'light',
	DARK: 'dark',
	HIGH_CONTRAST: 'high-contrast'
};

export const UI_FONT_SIZE = {
	SMALL: 'small',
	MEDIUM: 'medium',
	LARGE: 'large'
};

const STORAGE_KEYS = {
	THEME: 'themeLocal',
	FONT_SIZE: 'sizeLocal'
};

const getFromStorage = (key, defaultValue) => localStorage.getItem(key) || defaultValue;
const setInStorage = (key, value) => localStorage.setItem(key, value);

export const initialUIState = {
	modals: {},
	toasts: [],
	offcanvas: {},
	theme: getFromStorage(STORAGE_KEYS.THEME, UI_THEME.LIGHT),
	fontSize: getFromStorage(STORAGE_KEYS.FONT_SIZE, UI_FONT_SIZE.SMALL)
};

export const uiValidators = {
	modals: (value) => typeof value === 'object' && value !== null,
	toasts: (value) => Array.isArray(value),
	offcanvas: (value) => typeof value === 'object' && value !== null,
	theme: (value) => Object.values(UI_THEME).includes(value),
	fontSize: (value) => Object.values(UI_FONT_SIZE).includes(value)
};

export const uiReducers = {
	[uiActions.INITIALIZE]: (state, payload) => ({
		...initialUIState,
		...payload
	}),

	[uiActions.UPDATE]: (state, payload) => ({
		...state,
		...payload
	}),

	[uiActions.SHOW_MODAL]: (state, payload) => ({
		...state,
		modals: {
			...state.modals,
			[payload.id]: payload
		}
	}),

	[uiActions.HIDE_MODAL]: (state, payload) => {
		const { [payload.id]: _, ...remainingModals } = state.modals;
		return {
			...state,
			modals: remainingModals
		};
	},

	[uiActions.SHOW_TOAST]: (state, payload) => ({
		...state,
		toasts: [...state.toasts, payload]
	}),

	[uiActions.HIDE_TOAST]: (state, payload) => ({
		...state,
		toasts: state.toasts.filter(toast => toast.id !== payload.id)
	}),

	[uiActions.TOGGLE_OFFCANVAS]: (state, payload) => ({
		...state,
		offcanvas: {
			...state.offcanvas,
			[payload.id]: payload.isOpen
		}
	}),

	[uiActions.UPDATE_THEME]: (state, payload) => {
		const theme = payload.theme;
		setInStorage(STORAGE_KEYS.THEME, theme);
		return {
			...state,
			theme
		};
	},

	[uiActions.UPDATE_FONT_SIZE]: (state, payload) => {
		const fontSize = payload.fontSize;
		setInStorage(STORAGE_KEYS.FONT_SIZE, fontSize);
		return {
			...state,
			fontSize
		};
	}
}; 