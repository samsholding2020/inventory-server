import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return json({
    locations: [{ label: "Sam's Nail Supply - Head Quarter", value: "36382244961" }],
    rows: [
      {
        caseSku: "TEST-7577case/72",
        baseSku: "TEST-7577",
        caseQty: 4,
        baseQty: 62,
        unitsPerCase: 72,
        action: "No conversion needed",
      },
    ],
  });
}

export default function UnitConversionPage() {
  const data = useLoaderData<typeof loader>();
  const tableRows = data.rows.map((row) => [
    row.caseSku,
    row.baseSku,
    String(row.caseQty),
    String(row.baseQty),
    String(row.unitsPerCase),
    row.action,
  ]);

  return (
    <Page
      title="Unit Conversion"
      primaryAction={{ content: "Preview conversions", onAction: () => undefined }}
      secondaryActions={[{ content: "Manage mappings", url: "/app/mappings" }]}
    >
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Active mappings</Text>
              <Text as="p" variant="heading2xl">1</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Needs conversion</Text>
              <Text as="p" variant="heading2xl">0</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">System status</Text>
              <Badge tone="success">Ready</Badge>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="end">
                  <Select
                    label="Shopify location"
                    options={data.locations}
                    value={data.locations[0]?.value}
                    onChange={() => undefined}
                  />
                  <Button variant="primary">Preview conversions</Button>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "text"]}
                  headings={["Case SKU", "Base SKU", "Case qty", "Base qty", "Units/case", "Recommended action"]}
                  rows={tableRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
