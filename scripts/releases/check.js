const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('./lib');

function run(script, args = []) {
  execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

run('validate.js');
run('generate.js', ['--check']);
console.log('Release pipeline check passed.');
