import { type FlatXoConfig } from "xo";

const flatXoConfig: FlatXoConfig = [
	// The desktop wrapper type-checks itself with its own tsconfig and dependencies.
	{ ignores: ["desktop/**"] },
	{
		prettier: true,
		react: true,
		semicolon: true,
		space: false,
		rules: {
			"ava/no-ignored-test-files": "off",
			"ava/no-import-test-files": "off",
			"import-x/no-extraneous-dependencies": "off",
		},
	},
];

export default flatXoConfig;
