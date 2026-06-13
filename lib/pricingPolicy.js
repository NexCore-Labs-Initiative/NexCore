"use strict";

const PRICING_POLICY_VERSION = "2026-06-13";
const PRICING_POLICY_EFFECTIVE_DATE = "June 13, 2026";
const PAYMENTS_ENABLED = false;
const PAYMENTS_PAUSED_MESSAGE =
  "Payments are temporarily unavailable while NexCore completes its legal and regulatory review. No payment or transfer should be made.";
const OMR_TO_USD = 2.60;
const PAYPAL_FEE_RATE = 0.0349;
const PAYPAL_FEE_FIXED = 0.49;

const FEATURE_CATALOG = Object.freeze({
  support_1week:   { label: "Support - 1 Week", price: 0.250, available: true },
  support_1month:  { label: "Support - 1 Month", price: 0.500, available: true },
  support_3months: { label: "Support - 3 Months", price: 1.000, available: true },
  support_6months: { label: "Support - 6 Months", price: 1.500, available: true },
  support_1year:   { label: "Support - 1 Year", price: 2.500, available: true },
  lifetime:        { label: "Lifetime Access", price: 0.950, available: true },
  setup:           { label: "Professional Setup", price: 0.450, available: false },
  priority:        { label: "Priority Review", price: 0.300, available: true, bankTransferOnly: true },
  spotlight:       { label: "Featured Spotlight", price: 0.750, available: false },
  badge:           { label: "Custom Badge", price: 0.200, available: false },
});

function calcPayPalUsd(baseUsd) {
  return Math.ceil(((baseUsd + PAYPAL_FEE_FIXED) / (1 - PAYPAL_FEE_RATE)) * 100) / 100;
}

function validatePolicyAcceptance(accepted, version) {
  if (accepted !== true) {
    return "You must accept the Pricing & Billing Policy before placing an order.";
  }
  if (version !== PRICING_POLICY_VERSION) {
    return "The Pricing & Billing Policy has changed. Please review and accept the current version.";
  }
  return null;
}

function validatePaymentsEnabled() {
  return PAYMENTS_ENABLED ? null : PAYMENTS_PAUSED_MESSAGE;
}

function validateAndPriceFeatures(selectedFeatures, paymentMethod) {
  if (!Array.isArray(selectedFeatures) || selectedFeatures.length === 0) {
    return { error: "At least one feature must be selected." };
  }

  const ids = selectedFeatures.map((feature) => feature && feature.id);
  if (new Set(ids).size !== ids.length) {
    return { error: "Each feature can only be selected once." };
  }

  if (!ids.includes("lifetime")) {
    return { error: "Lifetime Access is required for every paid order." };
  }

  const features = [];
  let totalOmr = 0;

  for (const id of ids) {
    const item = FEATURE_CATALOG[id];
    if (!item) return { error: `Unknown feature: ${id}` };
    if (!item.available) return { error: `${item.label} is not currently available.` };
    if (item.bankTransferOnly && paymentMethod !== "bank_transfer") {
      return { error: `${item.label} is currently available only with bank transfer.` };
    }
    features.push({ id, label: item.label, price: item.price });
    totalOmr += item.price;
  }

  const supportCount = features.filter((feature) => feature.id.startsWith("support_")).length;
  if (supportCount > 1) {
    return { error: "Only one support duration can be selected." };
  }

  totalOmr = Math.round(totalOmr * 1000) / 1000;
  return {
    features,
    totalOmr,
    baseUsd: Math.round(totalOmr * OMR_TO_USD * 100) / 100,
  };
}

module.exports = {
  FEATURE_CATALOG,
  OMR_TO_USD,
  PAYPAL_FEE_FIXED,
  PAYPAL_FEE_RATE,
  PAYMENTS_ENABLED,
  PAYMENTS_PAUSED_MESSAGE,
  PRICING_POLICY_EFFECTIVE_DATE,
  PRICING_POLICY_VERSION,
  calcPayPalUsd,
  validateAndPriceFeatures,
  validatePaymentsEnabled,
  validatePolicyAcceptance,
};
