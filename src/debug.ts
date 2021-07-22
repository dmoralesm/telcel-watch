import debugModule from 'debug';

export const infoLog = debugModule('app:INFO');
export const debugLog = debugModule('app:DEBUG');
export const errorLog = debugModule('app:ERROR');
