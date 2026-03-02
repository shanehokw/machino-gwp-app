import { GwpRule } from "@prisma/client";
import type {
  CartTransformRunInput,
  CartTransformRunResult,
  LineExpandOperation,
  Operation,
} from "../generated/api";

const NO_CHANGES: CartTransformRunResult = {
  operations: [],
};

export function cartTransformRun(
  input: CartTransformRunInput,
): CartTransformRunResult {
  console.log(input);
  const cartLines = input.cart.lines;

  let subtotal = 0;
  for (const line of cartLines) {
    const amount = line.cost.totalAmount.amount;
    subtotal += parseFloat(amount);
  }

  console.log(subtotal);

  const applicableRules = getApplicableRules(input, subtotal);

  if (!applicableRules || applicableRules.length === 0) {
    return NO_CHANGES;
  }

  const uniqueGiftVariantIds = Array.from(
    new Set(applicableRules.map((rule) => rule.giftVariantId)),
  );

  if (uniqueGiftVariantIds.length === 0) {
    return NO_CHANGES;
  }

  // Choose a host line to expand (first ProductVariant that is not one of the gift variants)
  const hostLine = cartLines.find((line) => {
    const merch = line.merchandise;
    return (
      merch.__typename === "ProductVariant" &&
      !uniqueGiftVariantIds.includes(merch.id)
    );
  });

  if (!hostLine) {
    // No suitable host line (e.g. only gift lines or only custom products)
    return NO_CHANGES;
  }

  const hostMerch = hostLine.merchandise;
  if (hostMerch.__typename !== "ProductVariant") {
    return NO_CHANGES;
  }

  const hostQuantity = hostLine.quantity;
  if (hostQuantity <= 0) {
    return NO_CHANGES;
  }

  const hostTotalAmount = hostLine.cost.totalAmount.amount;
  const hostUnitPrice = hostTotalAmount / hostQuantity;

  const expandedCartItems: LineExpandOperation["expandedCartItems"] = [];

  // Original host item
  expandedCartItems.push({
    merchandiseId: hostMerch.id,
    quantity: hostQuantity,
    price: {
      adjustment: {
        fixedPricePerUnit: {
          amount: hostUnitPrice,
        },
      },
    },
    attributes: [],
  });

  // Gift items: one per unique applicable gift variant
  for (const giftVariantId of uniqueGiftVariantIds) {
    expandedCartItems.push({
      merchandiseId: giftVariantId,
      quantity: 1, // can make this configurable to allow more than 1 quantity per gift in the future
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: 0, // force price to zero
          },
        },
      },
      attributes: [],
    });
  }

  const expandOperation: LineExpandOperation = {
    cartLineId: hostLine.id,
    title: hostMerch.title ?? undefined,
    image: undefined,
    price: undefined,
    expandedCartItems,
  };

  const operations: Operation[] = [
    {
      lineExpand: expandOperation,
    },
  ];

  return { operations };
}

const getApplicableRules = (
  input: CartTransformRunInput,
  cartSubtotal: number,
) => {
  const gwpRulesMetafield = input.shop.gwpRules;

  if (!gwpRulesMetafield?.value) {
    return [];
  }

  try {
    const parsedRules = JSON.parse(gwpRulesMetafield.value) as GwpRule[];

    if (Array.isArray(parsedRules) && parsedRules.length > 0) {
      const candidateRules = parsedRules.filter(
        (rule) =>
          rule.isActive && // rule must be active
          new Date(rule.startAt) <= new Date() &&
          (!rule.endAt || new Date(rule.endAt) >= new Date()) && // current date must be between startAt and endAt (if endAt exists)
          rule.purchaseThreshold > 0 &&
          cartSubtotal * 100 >= rule.purchaseThreshold, // cart subtotal (in cents) must meet or exceed the purchase threshold
      );

      return candidateRules;
    }

    return parsedRules;
  } catch (error) {
    return null; // invalid JSON, treat as no rules
  }
};
