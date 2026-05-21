export * from "./k1-ensemble-spread";
export * from "./k2-policy-author";
export * from "./live-refresh";

export const REACTOR_CRADLE_SPIKE_PUBLIC_EXPORTS_V0 = Object.freeze({
  live_refresh: "./spikes/live-refresh",
  k1_ensemble_spread: "./spikes/k1-ensemble-spread",
  k2_policy_author: "./spikes/k2-policy-author",
} as const);

export const REACTOR_CRADLE_SPIKE_INTEGRATION_NOTES_V0 = Object.freeze([
  "K1/K2 spike evaluators are recorded-only by default; normal tests must not invoke live model refresh.",
  "Live OpenRouter refresh is an explicit opt-in guard path with cap/accounting input and secret redaction.",
] as const);
