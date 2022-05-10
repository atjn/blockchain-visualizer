"use strict";

/**
 * @file
 * This file confgures ESlint to use atjn's preferred settings.
 * ESlint makes sure that all JavaScript is formatted in a safe and somewhat standardized way.
 */

module.exports = {

  parserOptions: {
    sourceType: "module",
  },
	extends: [
		"@atjn/eslint-config",
	],

};
