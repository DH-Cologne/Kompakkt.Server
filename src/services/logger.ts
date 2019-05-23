import { join } from 'path';
import { inspect } from 'util';

import { LogLevel } from '../enums';
import { Environment, RootDirectory } from '../environment';

const _autosaveInterval = 30000;
const maxStackSize = 128;

const Logger = {
  path: join(RootDirectory, 'server.log'),
  stack: new Set([]),
  autosave: setInterval(() => Logger.writeToLog(), _autosaveInterval),
  info: content => {
    const message = `[INFO|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Info) console.log(message);
    Logger.shouldWrite();
  },
  log: content => {
    const message = `[LOG|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Log) console.log(message);
    Logger.shouldWrite();
  },
  warn: content => {
    const message = `[WARN|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Warn) console.log(message);
    Logger.shouldWrite();
  },
  err: content => {
    const message = `[ERR|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Error) console.log(message);
    Logger.shouldWrite();
  },
  getDate: () => {
    const now = new Date();
    return now.toISOString();
  },
  prepareContent: content => {
    return (typeof (content) === 'object')
      ? `\n${inspect(content, { showHidden: false, depth: undefined })}`
      : content;
  },
  shouldWrite: () => {
    if (Logger.stack.size >= maxStackSize) {
      Logger.writeToLog();
    }
  },
  writeToLog: () => {
    Logger.stack.clear();
  },
};

process.on('exit', code => {
  Logger.log(`Exiting with code ${code}`);
  Logger.writeToLog();
});

process.on('uncaughtException', error => Logger.err(error));
process.on('unhandledRejection', (reason, promise) => {
  Logger.warn(reason);
  Logger.warn(promise);
});
process.on('warning', warning => Logger.warn(warning));

export { Logger };
