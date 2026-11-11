"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDetectionService = void 0;
class IntentDetectionService {
    model;
    constructor(model) {
        this.model = model;
    }
    async detect(message) {
        const intent = await this.model.classifyIntent(message);
        return {
            name: intent.name.slice(0, 80),
            confidence: Math.max(0, Math.min(1, intent.confidence)),
            requiresTools: Boolean(intent.requiresTools),
            summary: intent.summary.slice(0, 500),
        };
    }
}
exports.IntentDetectionService = IntentDetectionService;
