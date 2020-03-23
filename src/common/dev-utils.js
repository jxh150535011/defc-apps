const chalk = require('chalk');
const execSync = require('child_process').execSync;
const spawn = require('cross-spawn');
const open = require('open');
const inquirer = require('inquirer');


const detect = require('detect-port-alt');

// https://github.com/sindresorhus/open#app
const OSX_CHROME = 'google chrome';

const isInteractive = process.stdout.isTTY;

const Actions = Object.freeze({
  NONE: 0,
  BROWSER: 1,
  SCRIPT: 2,
});

const getBrowserEnv = () => {
  // Attempt to honor this environment variable.
  // It is specific to the operating system.
  // See https://github.com/sindresorhus/open#app for documentation.
  const value = process.env.BROWSER;
  const args = process.env.BROWSER_ARGS
    ? process.env.BROWSER_ARGS.split(' ')
    : [];
  let action;
  if (!value) {
    // Default.
    action = Actions.BROWSER;
  } else if (value.toLowerCase().endsWith('.js')) {
    action = Actions.SCRIPT;
  } else if (value.toLowerCase() === 'none') {
    action = Actions.NONE;
  } else {
    action = Actions.BROWSER;
  }
  return { action, value, args };
}

function executeNodeScript(scriptPath, url) {
  const extraArgs = process.argv.slice(2);
  const child = spawn('node', [scriptPath, ...extraArgs, url], {
    stdio: 'inherit',
  });
  child.on('close', code => {
    if (code !== 0) {
      console.log();
      console.log(
        chalk.red(
          'The script specified as BROWSER environment variable failed.'
        )
      );
      console.log(chalk.cyan(scriptPath) + ' exited with code ' + code + '.');
      console.log();
      return;
    }
  });
  return true;
}

const clearConsole = () => {
  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
  );
}

const execOptions = {
  encoding: 'utf8',
  stdio: [
    'pipe', // stdin (default)
    'pipe', // stdout (default)
    'ignore', //stderr
  ],
};

function isProcessAReactApp(processCommand) {
  return /^node .*react-scripts\/scripts\/start\.js\s?$/.test(processCommand);
}

function getPackageNameInDirectory(directory) {
  const packagePath = path.join(directory.trim(), 'package.json');

  try {
    return require(packagePath).name;
  } catch (e) {
    return null;
  }
}

function getProcessIdOnPort(port) {
  return execSync('lsof -i:' + port + ' -P -t -sTCP:LISTEN', execOptions)
    .split('\n')[0]
    .trim();
}

function getDirectoryOfProcessById(processId) {
  return execSync(
    'lsof -p ' +
      processId +
      ' | awk \'$4=="cwd" {for (i=9; i<=NF; i++) printf "%s ", $i}\'',
    execOptions
  ).trim();
}

function getProcessCommand(processId, processDirectory) {
  const command = execSync(
    'ps -o command -p ' + processId + ' | sed -n 2p',
    execOptions
  );

  command = command.replace(/\n$/, '');

  if (isProcessAReactApp(command)) {
    const packageName = getPackageNameInDirectory(processDirectory);
    return packageName ? packageName : command;
  } else {
    return command;
  }
}

const getProcessForPort = (port) => {
  try {
    const processId = getProcessIdOnPort(port);
    const directory = getDirectoryOfProcessById(processId);
    const command = getProcessCommand(processId, directory);
    return (
      chalk.cyan(command) +
      chalk.grey(' (pid ' + processId + ')\n') +
      chalk.blue('  in ') +
      chalk.cyan(directory)
    );
  } catch (e) {
    return null;
  }
}

function startBrowserProcess(browser, url, args) {
  // If we're on OS X, the user hasn't specifically
  // requested a different browser, we can try opening
  // Chrome with AppleScript. This lets us reuse an
  // existing tab when possible instead of creating a new one.
  const shouldTryOpenChromeWithAppleScript =
    process.platform === 'darwin' &&
    (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromeWithAppleScript) {
    try {
      // Try our best to reuse existing tab
      // on OS X Google Chrome with AppleScript
      execSync('ps cax | grep "Google Chrome"');
      execSync('osascript openChrome.applescript "' + encodeURI(url) + '"', {
        cwd: __dirname,
        stdio: 'ignore',
      });
      return true;
    } catch (err) {
      // Ignore errors.
      console.warn('try open error', err)
    }
  }

  // Another special case: on OS X, check if BROWSER has been set to "open".
  // In this case, instead of passing `open` to `opn` (which won't work),
  // just ignore it (thus ensuring the intended behavior, i.e. opening the system browser):
  // https://github.com/facebook/create-react-app/pull/1690#issuecomment-283518768
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined;
  }

  // If there are arguments, they must be passed as array with the browser
  if (typeof browser === 'string' && args.length > 0) {
    browser = [browser].concat(args);
  }

  // Fallback to open
  // (It will always open new tab)
  try {
    var options = { app: browser, wait: false };
    open(url, options).catch(() => {console.log(4444);}); // Prevent `unhandledRejection` error.
    return true;
  } catch (err) {
    return false;
  }
}

const openBrowser = (url) => {
  const { action, value, args } = getBrowserEnv();
  switch (action) {
    case Actions.NONE:
      // Special case: BROWSER="none" will prevent opening completely.
      return false;
    case Actions.SCRIPT:
      return executeNodeScript(value, url);
    case Actions.BROWSER:
      return startBrowserProcess(value, url, args);
    default:
      throw new Error('Not implemented.');
  }
}

const isRoot = () => process.getuid && process.getuid() === 0;

const choosePort = async (host, defaultPort) => {
  try {
    const port = await detect(defaultPort, host);
    if (port === defaultPort) {
      return port;
    }
    const message = process.platform !== 'win32' && defaultPort < 1024 && !isRoot()
      ? `Admin permissions are required to run a server on a port below 1024.`
      : `Something is already running on port ${defaultPort}.`;
    if (isInteractive) {
      clearConsole();
      const existingProcess = getProcessForPort(defaultPort);
      const question = {
        type: 'confirm',
        name: 'shouldChangePort',
        message:
          chalk.yellow(
            message +
              `${existingProcess ? ` Probably:\n  ${existingProcess}` : ''}`
          ) + '\n\nWould you like to run the app on another port instead?',
        default: true,
      };
      const answer = await inquirer.prompt(question);
      if (answer.shouldChangePort) {
        return port;
      }
      return null;
    }
  }
  catch(err) {
    throw new Error(
      chalk.red(`Could not find an open port at ${chalk.bold(host)}.`) +
        '\n' +
        ('Network error message: ' + err.message || err) +
        '\n'
    );
  }

}

module.exports = {
  openBrowser,
  choosePort,
}