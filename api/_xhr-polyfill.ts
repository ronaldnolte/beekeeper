// Earth Engine's JavaScript client expects a browser XMLHttpRequest. Node has none, so provide
// one before the client loads (SCAR S-NEC-32). Import this module FIRST.

import XMLHttpRequest from 'xhr2';

const g = globalThis as { XMLHttpRequest?: unknown };
if (!g.XMLHttpRequest) g.XMLHttpRequest = XMLHttpRequest;
