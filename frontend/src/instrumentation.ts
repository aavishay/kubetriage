import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ZoneContextManager } from '@opentelemetry/context-zone';

export const initInstrumentation = () => {
    const provider = new WebTracerProvider({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: 'kubetriage-frontend',
        }),
    });

    // Export traces to Jaeger (OTLP HTTP)
    // Note: We use SimpleSpanProcessor for dev to see traces immediately.
    // In prod, use BatchSpanProcessor.
    const exporter = new OTLPTraceExporter({
        url: 'http://localhost:4318/v1/traces', // Jaeger OTLP HTTP port
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

    provider.register({
        contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
        instrumentations: [
            new DocumentLoadInstrumentation(),
            new FetchInstrumentation({
                propagateTraceHeaderCorsUrls: [/.+/g], // Inject headers for all requests
                clearTimingResources: true,
            }),
        ],
    });

    return provider;
};
