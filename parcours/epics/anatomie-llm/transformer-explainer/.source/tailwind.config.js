import flowbitePlugin from 'flowbite/plugin';
/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
	],

	plugins: [flowbitePlugin],

	// darkMode: 'class',

	theme: {
		extend: {
			screens: {
				sm: '',
				xs: ''
			},
			fontSize: {},
			colors: {
				blue: {
					50: '#eef6f0', 100: '#dfede3', 200: '#c1dccb', 300: '#99c6aa',
					400: '#6caa87', 500: '#4a906d', 600: '#31765d', 700: '#256348',
					800: '#234e3c', 900: '#203f33', 950: '#132b22'
				},
				purple: {
					50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
					400: '#eaa365', 500: '#d58a49', 600: '#b57036', 700: '#99592d',
					800: '#7c4829', 900: '#643d26', 950: '#352014'
				},
				cyan: {
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63',
					950: '#083344'
				}
			}
		}
	}
};
