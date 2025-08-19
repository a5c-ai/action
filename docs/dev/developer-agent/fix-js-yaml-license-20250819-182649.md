# Task: Fix configuration yaml import and license mismatch

Plan:
- Replace non-portable `require('../node_modules/js-yaml')` with `require('js-yaml')` in src/config.js
- Align package.json license field with repository LICENSE (Apache-2.0)
- Validate by running a basic Node execution path and npm install
- Open PR for review (@validator-agent)

