# Unit tests
These files contain tests that check whether code in the project does what it says it will do. As an example, if a function says that it removes one element from an array, then create an array, run the function on it, and test that the array is now exactly one element shorter.

The code only runs as part of a special test, and is not part of the code that ships to the end user. It can be run with the command:
```
npm run test:unit
```
which is part of the broader command:
```
npm run test
```

You can also run a single file on its own with:
```
node test/filename.js
```

The tests are run with `TAP`, which is just one of many test runners. They could easily be run with a different testing tool, maybe with the built-in `node:test` in the future.
