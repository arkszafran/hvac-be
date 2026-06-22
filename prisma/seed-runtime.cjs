const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

require('ts-node/register');
require('tsconfig-paths/register');

const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTypescriptJsImports(
  request,
  parent,
  isMain,
  options,
) {
  try {
    return resolveFilename.call(this, request, parent, isMain, options);
  } catch (error) {
    if (
      error &&
      error.code === 'MODULE_NOT_FOUND' &&
      parent &&
      request.startsWith('.') &&
      request.endsWith('.js')
    ) {
      const tsRequestPath = path.resolve(
        path.dirname(parent.filename),
        request.replace(/\.js$/, '.ts'),
      );

      if (fs.existsSync(tsRequestPath)) {
        return tsRequestPath;
      }
    }

    throw error;
  }
};
