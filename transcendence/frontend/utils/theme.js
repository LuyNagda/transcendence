// Theme and Font Size Management

// Get stored theme and font size preferences, or set defaults
const themeLocal = localStorage.getItem('themeLocal') || 'light';
const sizeLocal = localStorage.getItem('sizeLocal') || 'small';

// Get DOM elements
const navbarBrand = document.querySelector('.navbar-brand');
const btn = document.querySelector('.btn');
const formControls = document.querySelectorAll('.form-control');
const toggleFontSizeBtn = document.getElementById('toggleFontSizeBtn');

// Font size application function
function applyFontSize(size) {
	if (size == 'large') {
		localStorage.setItem('sizeLocal', 'large');
		document.body.style.fontSize = '1.5rem';
		if (navbarBrand) navbarBrand.style.fontSize = '1.5rem';
		if (btn) btn.style.fontSize = '1.5rem';
		if (formControls) {
			formControls.forEach(function (formControl) {
				formControl.style.fontSize = '1.5rem';
				formControl.style.paddingTop = '3rem';
				formControl.style.paddingBottom = '2rem';
			});
		}
	} else {
		localStorage.setItem('sizeLocal', 'small');
		document.body.style.fontSize = '1rem';
		if (navbarBrand) navbarBrand.style.fontSize = '1.25rem';
		if (btn) btn.style.fontSize = '1rem';
		if (formControls) {
			formControls.forEach(function (formControl) {
				formControl.style.fontSize = '1rem';
				formControl.style.padding = '0.375rem 0.75rem';
			});
		}
	}
}

// Theme application function
function applyTheme(theme) {
	localStorage.setItem('themeLocal', theme);
	document.documentElement.setAttribute('data-bs-theme', theme);
	var themeIcon = document.getElementById('themeIcon');
	if (themeIcon) {
		switch (theme) {
			case 'light':
				themeIcon.setAttribute('d', 'M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708');
				break;
			case 'dark':
				themeIcon.setAttribute('d', 'M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286');
				break;
			case 'high-contrast':
				themeIcon.setAttribute('d', 'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0');
				break;
		}
	}
}

// Initialize theme and font size
function initializeThemeAndFontSize() {
	applyFontSize(sizeLocal);
	applyTheme(themeLocal);

	if (toggleFontSizeBtn) {
		toggleFontSizeBtn.checked = sizeLocal === 'large';
		toggleFontSizeBtn.addEventListener('click', function () {
			applyFontSize(this.checked ? 'large' : 'small');
		});
	}

	document.getElementById('light')?.addEventListener('click', () => applyTheme('light'));
	document.getElementById('dark')?.addEventListener('click', () => applyTheme('dark'));
	document.getElementById('highContrast')?.addEventListener('click', () => applyTheme('high-contrast'));
}

export { initializeThemeAndFontSize, applyTheme, applyFontSize };
