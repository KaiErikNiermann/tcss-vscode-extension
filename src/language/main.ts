import { startLanguageServer } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { ProposedFeatures, createConnection } from 'vscode-languageserver/node';

import { createTcssServices } from './tcssModule.js';

const connection = createConnection(ProposedFeatures.all);
const { shared } = createTcssServices({ connection, ...NodeFileSystem });
startLanguageServer(shared);
