"use strict";

const baseConfig = require("./base.js");
const globals = require("globals");

module.exports = [
	...baseConfig,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
];
