"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpairedDesktopProviderGateway = void 0;
/** A fail-closed bridge until a signed-in Electron main process is paired. */
class UnpairedDesktopProviderGateway {
    async *stream() {
        yield {
            type: "error",
            code: "desktop_provider_unavailable",
            message: "No paired JVerse desktop provider is available.",
        };
    }
}
exports.UnpairedDesktopProviderGateway = UnpairedDesktopProviderGateway;
