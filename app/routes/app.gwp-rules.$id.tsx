import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  HeadersFunction,
} from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useParams,
  useSubmit,
  useNavigate,
  useNavigation,
} from "react-router";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import {
  getGwpRule,
  syncGwpMetafield,
  validateRuleInput,
} from "../models/GWPRule.server";

type FormState = {
  id: number | null;
  name: string;
  giftVariantId: string;
  purchaseThreshold: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
};

// type LoaderData = Awaited<ReturnType<typeof loader>>;
type ActionData = {
  errors?: Record<string, string>;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return {
      id: null,
      name: "",
      giftVariantId: "",
      purchaseThreshold: "",
      startAt: new Date().toISOString().split("T")[0],
      endAt: "",
      isActive: true,
    } as FormState;
  }

  const rule = await getGwpRule(Number(params.id), admin.graphql);

  if (!rule) {
    throw redirect("/app");
  }

  return {
    id: rule.id,
    name: rule.name,
    giftVariantId: rule.giftVariantId,
    purchaseThreshold: (rule.purchaseThreshold / 100).toFixed(2),
    startAt: rule.startAt.toISOString().split("T")[0],
    endAt: rule.endAt ? rule.endAt.toISOString().split("T")[0] : "",
    isActive: rule.isActive,

    giftProductId: rule.productId,
    variantTitle: rule.variantTitle,
    variantImage: rule.variantImage,
  } as FormState;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const formObject = Object.fromEntries(formData) as Record<string, unknown>;

  if (formObject.action === "delete") {
    await db.gwpRule.delete({ where: { id: Number(params.id) } });
    throw redirect("/app");
  }

  const errors = validateRuleInput({
    name: String(formObject.name || ""),
    giftVariantId: String(formObject.giftVariantId || ""),
    purchaseThreshold: Number(formObject.purchaseThreshold || 0),
    startAt: new Date(String(formObject.startAt || "")),
  });

  if (errors) {
    return new Response(JSON.stringify({ errors }), {
      status: 422,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const purchaseThresholdRaw = String(formObject.purchaseThreshold || "0");
  const purchaseThresholdCents = Math.round(Number(purchaseThresholdRaw) * 100);

  const data = {
    name: String(formObject.name),
    giftVariantId: String(formObject.giftVariantId),
    purchaseThreshold: purchaseThresholdCents,
    startAt: new Date(String(formObject.startAt)),
    endAt: formObject.endAt ? new Date(String(formObject.endAt)) : null,
    isActive: formObject.isActive === "true",
    createdAt: params.id === "new" ? new Date() : undefined,
  };

  const rule =
    params.id === "new"
      ? await db.gwpRule.create({
          data: data as Parameters<typeof db.gwpRule.create>[0]["data"],
        })
      : await db.gwpRule.update({
          where: { id: Number(params.id) },
          data: data as Parameters<typeof db.gwpRule.update>[0]["data"],
        });

  await syncGwpMetafield(admin.graphql);

  return redirect(`/app/gwp-rules/${rule.id}`);
}

export default function GwpRuleForm() {
  const navigate = useNavigate();
  const { id } = useParams();

  const rule = useLoaderData();
  const [initialFormState, setInitialFormState] = useState(rule);
  const [formState, setFormState] = useState(rule);
  const errors = useActionData<ActionData>()?.errors || {};
  const isSaving = useNavigation().state === "submitting";
  const isDirty =
    JSON.stringify(formState) !== JSON.stringify(initialFormState);

  async function selectVariant() {
    const variants = await window.shopify.resourcePicker({
      type: "variant",
      action: "select",
    });

    if (variants) {
      const { id, title, image, product } = variants[0];

      setFormState({
        ...formState,
        giftProductId: product.id,
        giftVariantId: id,
        variantTitle: title,
        variantImage: image?.originalSrc,
      });
    }
  }

  function removeVariant() {
    setFormState({
      ...formState,
      giftVariantId: "",
    });
  }

  const variantUrl = formState.giftProductId
    ? `shopify://admin/products/${formState.giftProductId.split("/").at(-1)}/variants/${formState.giftVariantId}`
    : undefined;

  const submit = useSubmit();

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = {
      name: formState.name,
      giftVariantId: formState.giftVariantId,
      purchaseThreshold: formState.purchaseThreshold,
      startAt: formState.startAt,
      endAt: formState.endAt,
      isActive: formState.isActive,
    };

    submit(data, { method: "post" });
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this rule?")) {
      submit({ action: "delete" }, { method: "post" });
    }
  };

  function handleReset() {
    setFormState(initialFormState);
    window.shopify.saveBar.hide("gwp-rule-form");
  }

  useEffect(() => {
    if (isDirty) {
      window.shopify.saveBar.show("gwp-rule-form");
    } else {
      window.shopify.saveBar.hide("gwp-rule-form");
    }
    return () => {
      window.shopify.saveBar.hide("gwp-rule-form");
    };
  }, [isDirty]);

  useEffect(() => {
    setInitialFormState(rule);
    setFormState(rule);
  }, [id, rule]);

  return (
    <>
      <form data-save-bar onSubmit={handleSave} onReset={handleReset}>
        <s-page heading={initialFormState.name || "Create GWP Rule"}>
          <s-link
            href="/app"
            slot="breadcrumb-actions"
            onClick={(e) => (isDirty ? e.preventDefault() : navigate("/app/"))}
          >
            GWP Rules
          </s-link>
          {initialFormState.id && (
            <s-button slot="secondary-actions" onClick={handleDelete}>
              Delete
            </s-button>
          )}
          <s-section heading="GWP Rule Details">
            <s-stack gap="base">
              <s-text-field
                label="Name"
                error={errors.name}
                name="title"
                value={formState.name}
                onInput={(e) => {
                  const value = (e.target as unknown as { value: string })
                    .value;

                  setFormState({ ...formState, name: value });
                }}
              ></s-text-field>
              <s-switch
                label="Activate Rule"
                checked={formState.isActive}
                onChange={(e) => {
                  const checked = (e.target as unknown as { checked: boolean })
                    .checked;
                  setFormState({ ...formState, isActive: checked });
                }}
              />
              <s-stack gap="small-400">
                <s-stack
                  direction="inline"
                  gap="small-100"
                  justifyContent="space-between"
                >
                  <s-text color="subdued">Gift Product Variant</s-text>
                  {formState.giftVariantId ? (
                    <s-link
                      onClick={removeVariant}
                      accessibilityLabel="Remove the gift variant from this GWP Rule"
                      tone="neutral"
                    >
                      Clear
                    </s-link>
                  ) : null}
                </s-stack>
                {formState.giftVariantId ? (
                  <s-stack
                    direction="inline"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <s-stack
                      direction="inline"
                      gap="small-100"
                      alignItems="center"
                    >
                      <s-clickable
                        href={variantUrl}
                        target="_blank"
                        borderRadius="base"
                      >
                        <s-box
                          padding="small-200"
                          border="base"
                          borderRadius="base"
                          background="subdued"
                          inlineSize="38px"
                          blockSize="38px"
                        >
                          {formState.variantImage ? (
                            <s-image src={formState.variantImage}></s-image>
                          ) : (
                            <s-icon size="base" type="product" />
                          )}
                        </s-box>
                      </s-clickable>
                      <s-link href={variantUrl} target="_blank">
                        {formState.variantTitle}
                      </s-link>
                    </s-stack>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        onClick={selectVariant}
                        accessibilityLabel="Change the gift variant for this GWP Rule"
                      >
                        Change
                      </s-button>
                    </s-stack>
                  </s-stack>
                ) : (
                  <s-button
                    onClick={selectVariant}
                    accessibilityLabel="Select the gift variant for this GWP Rule"
                  >
                    Select variant
                  </s-button>
                )}
              </s-stack>
              <s-stack direction="inline" gap="base">
                <s-number-field
                  label="Minimum Purchase Amount (MYR, to two-decimal places)"
                  error={errors.purchaseThreshold}
                  name="purchaseThreshold"
                  value={formState.purchaseThreshold}
                  step={0.01}
                  onInput={(e) => {
                    const value = (e.target as unknown as { value: string })
                      .value;
                    setFormState({ ...formState, purchaseThreshold: value });
                  }}
                ></s-number-field>
              </s-stack>

              <s-stack direction="inline" gap="base">
                <s-date-field
                  label="Start Date"
                  error={errors.startAt}
                  name="startAt"
                  value={formState.startAt}
                  onInput={(e) => {
                    const value = (e.target as unknown as { value: string })
                      .value;
                    setFormState({ ...formState, startAt: value });
                  }}
                ></s-date-field>

                <s-date-field
                  label="End Date (Optional)"
                  name="endAt"
                  value={formState.endAt}
                  onChange={(e) => {
                    const value = (e.target as unknown as { value: string })
                      .value;
                    setFormState({ ...formState, endAt: value });
                  }}
                ></s-date-field>
              </s-stack>

              <s-stack direction="inline" gap="base">
                <s-button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Rule"}
                </s-button>

                {initialFormState.id && (
                  <s-button tone="critical" onClick={handleDelete}>
                    Delete Rule
                  </s-button>
                )}
              </s-stack>
            </s-stack>
          </s-section>
        </s-page>
      </form>
    </>

    // <s-page heading={fieldState.name || "Create GWP Rule"}>
    //   <s-section>
    //     <form method="post">
    //       <s-stack gap="base">
    //         <s-text-field
    //           label="Rule Name"
    //           name="name"
    //           value={fieldState.name}
    //           onInput={(e) => {
    //             const value = (e.target as unknown as { value: string }).value;
    //             setFieldState({ ...fieldState, name: value });
    //           }}
    //           error={errors.name}
    //           required
    //         />

    //         <s-text-field
    //           label="Gift Variant ID"
    //           name="giftVariantId"
    //           value={fieldState.giftVariantId}
    //           onInput={(e) => {
    //             const value = (e.target as unknown as { value: string }).value;
    //             setFieldState({ ...fieldState, giftVariantId: value });
    //           }}
    //           error={errors.giftVariantId}
    //           required
    //         />

    //         <s-text-field
    //           label="Purchase Threshold"
    //           name="purchaseThreshold"
    //           value={fieldState.purchaseThreshold}
    //           onInput={(e) => {
    //             const value = (e.target as unknown as { value: string }).value;
    //             setFieldState({ ...fieldState, purchaseThreshold: value });
    //           }}
    //           error={errors.purchaseThreshold}
    //           required
    //         />

    //         <s-text-field
    //           label="Start Date"
    //           name="startAt"
    //           value={fieldState.startAt}
    //           onInput={(e) => {
    //             const value = (e.target as unknown as { value: string }).value;
    //             setFieldState({ ...fieldState, startAt: value });
    //           }}
    //           error={errors.startAt}
    //           required
    //         />

    //         <s-button type="submit" disabled={isLoading}>
    //           {isLoading ? "Saving..." : "Save Rule"}
    //         </s-button>

    //         {fieldState.id && (
    //           <s-button tone="critical" onClick={handleDelete}>
    //             Delete Rule
    //           </s-button>
    //         )}
    //       </s-stack>
    //     </form>

    //     {Object.keys(errors).length > 0 && (
    //       <s-box paddingBlockStart="base">
    //         <s-heading>Errors</s-heading>
    //         <s-unordered-list>
    //           {Object.entries(errors).map(([field, message]) => (
    //             <s-list-item key={field}>
    //               <s-text>
    //                 {field}: {message}
    //               </s-text>
    //             </s-list-item>
    //           ))}
    //         </s-unordered-list>
    //       </s-box>
    //     )}
    //   </s-section>
    // </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
