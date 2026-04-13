import { type FlatXoConfig } from "xo";

const flatXoConfig: FlatXoConfig = {
	prettier: true,
	react: true,
	semicolon: true,
	space: false,
	rules: {
		"import-x/no-extraneous-dependencies": "off",
	},
};

export default flatXoConfig;
