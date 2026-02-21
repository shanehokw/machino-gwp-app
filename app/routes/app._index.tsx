import type { HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { getGwpRules, SupplementedGwpRule } from "../models/GWPRule.server";

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const rules = await getGwpRules(admin.graphql);

  return {
    rules,
  };
}

const EmptyGWPRuleState = () => (
  <s-section accessibilityLabel="Empty state section">
    <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
      <s-box maxInlineSize="200px" maxBlockSize="200px">
        <s-image
          aspectRatio="1/0.5"
          src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          alt="A stylized graphic of a document"
        />
      </s-box>
      <s-grid justifyItems="center" maxBlockSize="450px" maxInlineSize="450px">
        <s-heading>Create GWP Rules for your store</s-heading>
        <s-stack
          gap="small-200"
          justifyContent="center"
          padding="base"
          paddingBlockEnd="none"
          direction="inline"
        >
          <s-button href="/app/gwp-rules/new" variant="primary">
            Create GWP Rule
          </s-button>
        </s-stack>
      </s-grid>
    </s-grid>
  </s-section>
);

function truncate(str: string, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const GWPRuleTable = ({ rules }: { rules: SupplementedGwpRule[] }) => (
  <s-section padding="none" accessibilityLabel="GWP Rules table">
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Title</s-table-header>
        <s-table-header>Variant</s-table-header>
        <s-table-header>Date created</s-table-header>
        <s-table-header>Scans</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rules.map((rule) => (
          <GWPRuleTableRow key={rule.id} rule={rule} />
        ))}
      </s-table-body>
    </s-table>
  </s-section>
);

const GWPRuleTableRow = ({ rule }: { rule: SupplementedGwpRule }) => (
  <s-table-row id={rule.id.toString()}>
    <s-table-cell>
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-clickable
          href={`/app/gwp-rules/${rule.id}`}
          accessibilityLabel={`Go to the product page for ${rule.variantDeleted ? "deleted variant" : rule.variantTitle}`}
          border="base"
          borderRadius="base"
          overflow="hidden"
          inlineSize="20px"
          blockSize="20px"
        >
          {!rule?.variantDeleted ? (
            <s-image objectFit="cover" src={rule.variantImage}></s-image>
          ) : (
            <s-icon size="base" type="image" />
          )}
        </s-clickable>
        <s-link href={`/app/gwp-rules/${rule.id}`}>
          {truncate(rule.name)}
        </s-link>
      </s-stack>
    </s-table-cell>
    <s-table-cell>
      {rule.variantDeleted ? (
        <s-badge icon="alert-diamond" tone="critical">
          Variant has been deleted
        </s-badge>
      ) : (
        truncate(rule.variantTitle)
      )}
    </s-table-cell>
    <s-table-cell>{new Date(rule.createdAt).toDateString()}</s-table-cell>
  </s-table-row>
);

export default function Index() {
  const { rules } = useLoaderData();

  return (
    <s-page heading="GWP Rules">
      <s-link slot="secondary-actions" href="/app/gwp-rules/new">
        Create GWP Rule
      </s-link>
      {rules.length === 0 ? (
        <EmptyGWPRuleState />
      ) : (
        <GWPRuleTable rules={rules} />
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
