const config = {
	extensions: {
		ts: "module",
		tsx: "module",
	},
	nodeArguments: ["--loader=ts-node/esm"],
	typescript: {
		compile: "tsc",
		rewritePaths: {
			"source/": "build/",
		},
	},
};

export default config;
