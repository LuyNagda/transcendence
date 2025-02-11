export const uiActions = {
	INITIALIZE: 'INITIALIZE',
	SHOW_MODAL: 'SHOW_MODAL',
	HIDE_MODAL: 'HIDE_MODAL',
	SHOW_TOAST: 'SHOW_TOAST',
	HIDE_TOAST: 'HIDE_TOAST',
	TOGGLE_OFFCANVAS: 'TOGGLE_OFFCANVAS',
	UPDATE_THEME: 'UPDATE_THEME',
	UPDATE_FONT_SIZE: 'UPDATE_FONT_SIZE',
	UPDATE: 'UPDATE',
	LOAD_FRIEND_REQUESTS: 'LOAD_FRIEND_REQUESTS'
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
	fontSize: (value) => {
		if (value instanceof Event) return false;
		if (typeof value !== 'string') return false;
		return Object.values(UI_FONT_SIZE).includes(value);
	}
};

export const uiReducers = {
	[uiActions.INITIALIZE]: (state, payload) => {
		// Validate payload
		const validatedPayload = {
			...payload,
			theme: payload.theme && Object.values(UI_THEME).includes(payload.theme)
				? payload.theme
				: getFromStorage(STORAGE_KEYS.THEME, UI_THEME.LIGHT),
			fontSize: payload.fontSize && Object.values(UI_FONT_SIZE).includes(payload.fontSize)
				? payload.fontSize
				: getFromStorage(STORAGE_KEYS.FONT_SIZE, UI_FONT_SIZE.SMALL)
		};

		return {
			...initialUIState,
			...validatedPayload
		};
	},

	[uiActions.UPDATE]: (state, payload) => {
		// Validate payload before applying
		const validatedPayload = {
			...payload,
			theme: payload.theme ? (Object.values(UI_THEME).includes(payload.theme) ? payload.theme : state.theme) : state.theme,
			fontSize: payload.fontSize ? (Object.values(UI_FONT_SIZE).includes(payload.fontSize) ? payload.fontSize : state.fontSize) : state.fontSize
		};

		return {
			...state,
			...validatedPayload
		};
	},

	[uiActions.SHOW_MODAL]: (state, payload) => ({
		...state,
		modals: {
			...state.modals,
			[payload.id]: payload
		},
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
		// Validate font size
		if (!fontSize || typeof fontSize !== 'string' || !Object.values(UI_FONT_SIZE).includes(fontSize)) {
			return state;
		}
		setInStorage(STORAGE_KEYS.FONT_SIZE, fontSize);
		return {
			...state,
			fontSize
		};
	},

	[uiActions.LOAD_FRIEND_REQUESTS]: (state, payload) => ({
		...state,
		friendRequests: payload.requests
	})
}; 