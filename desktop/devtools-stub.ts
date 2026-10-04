// Ink loads React DevTools only when DEV=true, which the desktop app never sets.
const devtools = {
	initialize() {
		// Never called.
	},
	connectToDevTools() {
		// Never called.
	},
};

export default devtools;
