import { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { GwpRule } from "@prisma/client";
import { ProductVariant } from "@shopify/app-bridge-react";

export type SupplementedGwpRule = GwpRule &
  (
    | {
        variantDeleted: true;
      }
    | {
        variantDeleted: false;
        variantTitle: string;
        variantImage: string;
        variantImageAlt: string;
      }
  );

export async function getGwpRule(
  id: number,
  graphql: AdminApiContext["graphql"],
) {
  const rule = await db.gwpRule.findFirst({ where: { id } });

  if (!rule) {
    return null;
  }

  return supplementGwpRule(rule, graphql);
}

export async function getGwpRules(graphql: AdminApiContext["graphql"]) {
  const rules = await db.gwpRule.findMany({
    orderBy: { id: "desc" },
  });

  if (rules.length === 0) return [];

  return Promise.all(rules.map((rule) => supplementGwpRule(rule, graphql)));
}

async function supplementGwpRule(
  rule: GwpRule,
  graphql: AdminApiContext["graphql"],
) {
  try {
    const response = await graphql(
      `
        query supplementGwpRule($variantId: ID!) {
          productVariant(id: $variantId) {
            title
            media(first: 1) {
              nodes {
                preview {
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          variantId: rule.giftVariantId,
        },
      },
    );

    const res: { data?: { productVariant: ProductVariant } } =
      await response.json();

    const variant = res.data?.productVariant;

    return {
      ...rule,
      variantDeleted: !variant?.title,
      variantTitle: variant?.title,
      variantImage: variant?.image?.originalSrc,
      variantImageAlt: variant?.image?.altText,
    };
  } catch (error) {
    console.log(error);
  }
}

export type GwpRuleInputParams = {
  name: string;
  giftVariantId: string;
  purchaseThreshold: number;
  startAt: Date;
};

export function validateRuleInput(data: GwpRuleInputParams) {
  const errors: Record<string, string> = {};

  if (!data.name) {
    errors.name = "Name is required";
  }

  if (!data.giftVariantId) {
    errors.giftVariantId = "Gift variant is required";
  }

  if (data.purchaseThreshold <= 0) {
    errors.purchaseThreshold = "Threshold amount must be greater than 0";
  }

  if (!data.startAt || isNaN(data.startAt.getTime())) {
    errors.startAt = "Start date is required";
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }
}

/**
 * GiftWithPurchaseDiscount model
 * Handles creating automatic BXGY discounts for gift with purchase promotions
 */

// type CreateGiftWithPurchaseDiscountParams = {
//   thresholdAmount: string;
//   giftProductGid: string;
//   startsAt: string;
//   endsAt?: string | null;
// };

// type CreateGiftWithPurchaseDiscountResponse = {
//   automaticDiscountNode: {
//     id: string;
//     automaticDiscount: {
//       __typename: string;
//       title: string;
//       startsAt: string;
//       endsAt: string | null;
//     };
//   };
//   userErrors: Array<{
//     field: string[];
//     message: string;
//   }>;
// };

// /**
//  * Creates an automatic "spend X, get Y free" discount via Admin GraphQL.
//  *
//  * @param graphql - The GraphQL admin API function
//  * @param params - Discount creation parameters
//  * @returns The created discount node and any user errors
//  */
// export async function createGiftWithPurchaseDiscount(
//   graphql: any,
//   {
//     thresholdAmount,
//     giftProductGid,
//     startsAt,
//     endsAt = null,
//   }: CreateGiftWithPurchaseDiscountParams,
// ): Promise<CreateGiftWithPurchaseDiscountResponse> {
//   const mutation = `
//     #graphql
//     mutation CreateGiftWithPurchaseDiscount($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
//       discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
//         automaticDiscountNode {
//           id
//           automaticDiscount {
//             __typename
//             ... on DiscountAutomaticBxgy {
//               title
//               startsAt
//               endsAt
//             }
//           }
//         }
//         userErrors {
//           field
//           message
//         }
//       }
//     }
//   `;

//   const variables = {
//     automaticBxgyDiscount: {
//       title: "Spend RM100, Get Free Gift",
//       startsAt,
//       endsAt,
//       customerBuys: {
//         isOneTimePurchase: true,
//         isSubscription: false,
//         items: null,
//         value: {
//           amount: thresholdAmount,
//         },
//       },
//       customerGets: {
//         appliesOnOneTimePurchase: true,
//         appliesOnSubscription: false,
//         items: {
//           products: {
//             productsToAdd: [giftProductGid],
//           },
//         },
//         value: {
//           discountOnQuantity: {
//             quantity: "1",
//             effect: {
//               percentage: 1,
//             },
//           },
//         },
//       },
//       usesPerOrderLimit: "1",
//     },
//   };

//   const response = await graphql(mutation, { variables });
//   const { data, errors } = await response.json();

//   if (errors) {
//     throw new Error(`GraphQL error: ${JSON.stringify(errors)}`);
//   }

//   return data.discountAutomaticBxgyCreate;
// }
