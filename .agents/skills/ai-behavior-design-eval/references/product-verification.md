# Product verification

Intent: establish release readiness after benchmark acceptance by testing actual downstream consumption.

## Production path

Exercise the real request builder, model client, parser, and validation path with production settings; document any test limit. Cover applicable positive, negative, boundary, and recovery cases. Assert the response contract and decisions separately from generated content, preserving exact inputs, raw/parsed outputs, settings, and results.

## Browser or downstream consumer

Start from the real user action. Demonstrate parsing, storage/dispatch, consumption of each applicable decision and response, expected visible effects, absence of prohibited effects, and visible recovery after invalid output or a failed request. Merely displaying generated text does not establish decision consumption.

Preserve the linked AI run ID, browser inputs, UI state, failure screenshots, and console/network errors. Use the corresponding downstream integration check when the product has no browser UI.

## Release verdict

All required product cases must pass. Name the exact benchmark, production, and browser/downstream run IDs supporting release readiness. Explicit non-release deferrals remain pending checks, not successful evidence. A saved-benchmark review does not acquire a release-verification requirement unless release was in scope.
