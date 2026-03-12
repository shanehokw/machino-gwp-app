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
        productId: string;
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
  const response = await graphql(
    `
      query supplementGwpRule($variantId: ID!) {
        productVariant(id: $variantId) {
          title
          product {
            id
          }
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
    productId: variant?.product.id,
    variantTitle: variant?.title,
    variantImage: variant?.image?.originalSrc,
    variantImageAlt: variant?.image?.altText,
  };
}

export async function syncGwpMetafield(graphql: AdminApiContext["graphql"]) {
  const rules = await db.gwpRule.findMany({
    orderBy: { id: "desc" },
  });

  const shopResponse = await graphql(`
    query {
      shop {
        id
      }
    }
  `);

  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  await graphql(
    `
      mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            namespace: "gwp",
            key: "rules",
            type: "json",
            value: JSON.stringify(rules),
            ownerId: shopId,
          },
        ],
      },
    },
  );

  await setPublicAccessonGwpMetafield(graphql);
}

async function setPublicAccessonGwpMetafield(
  graphql: AdminApiContext["graphql"],
) {
  // await graphql(
  //   `
  //     mutation MetafieldDefinitionSetStorefrontAccess(
  //       $definition: MetafieldDefinitionUpdateInput!
  //     ) {
  //       metafieldDefinitionUpdate(definition: $definition) {
  //         updatedDefinition {
  //           id
  //           namespace
  //           key
  //           access {
  //             storefront
  //           }
  //         }
  //         userErrors {
  //           field
  //           message
  //           code
  //         }
  //       }
  //     }
  //   `,
  //   {
  //     variables: {
  //       definition: {
  //         namespace: "gwp",
  //         key: "rules",
  //         ownerType: "SHOP",
  //         access: {
  //           storefront: "PUBLIC_READ",
  //         },
  //       },
  //     },
  //   },
  // );

  await graphql(`
    mutation CreateProductMetafieldDefinition {
      metafieldDefinitionCreate(
        definition: {
          namespace: "gwp"
          key: "rules"
          name: "GWP Rules"
          type: "json"
          ownerType: SHOP
          access: { storefront: PUBLIC_READ }
        }
      ) {
        createdDefinition {
          id
          namespace
          key
          access {
            storefront
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `);
}

export type GwpRuleInputParams = {
  name: string;
  giftVariantId: string;
  purchaseThreshold: number; // in cents
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
