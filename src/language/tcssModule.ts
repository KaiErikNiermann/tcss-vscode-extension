import { type Module, inject } from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
  type PartialLangiumServices,
} from 'langium/lsp';

import { TcssGeneratedModule, TcssGeneratedSharedModule } from './generated/module.js';
import { TcssDocumentValidator } from './tcssDocumentValidator.js';
import { TcssFormatter } from './tcssFormatter.js';
import { registerValidationChecks } from './tcssValidator.js';

export type TcssServices = LangiumServices;

/** What this language overrides on top of Langium's defaults. */
export const TcssModule: Module<TcssServices, PartialLangiumServices> = {
  lsp: {
    Formatter: () => new TcssFormatter(),
  },
  validation: {
    DocumentValidator: (services) => new TcssDocumentValidator(services),
  },
};

/**
 * Build the shared and language-specific service containers.
 *
 * Both come back because the language server needs the shared one to start, and the
 * language one to register validation and to reach the parser from tests.
 */
export function createTcssServices(context: DefaultSharedModuleContext): {
  shared: LangiumSharedServices;
  Tcss: TcssServices;
} {
  const shared = inject(createDefaultSharedModule(context), TcssGeneratedSharedModule);
  const Tcss = inject(createDefaultModule({ shared }), TcssGeneratedModule, TcssModule);
  shared.ServiceRegistry.register(Tcss);
  registerValidationChecks(Tcss);
  return { shared, Tcss };
}
