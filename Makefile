publish:
	npm publish --dry-run
	npm link
install:
	npm ci
test:
	npm test
test-coverage:
	npm test -- --coverage --coverageProvider=v8
lint: 
	npx eslint .
debug:
	npm run debug