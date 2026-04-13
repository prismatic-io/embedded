import {
  BooleanOperator,
  ConditionalExpression,
  TermOperator,
} from "./conditionalLogic";

export { BooleanOperator, ConditionalExpression, TermOperator };

export interface MarketplaceFilters {
  category?: string;
  filterQuery?: ConditionalExpression;
  includeActiveIntegrations?: boolean;
  label?: string;
  strictMatchFilterQuery?: boolean;
}

export interface ComponentsFilters {
  category?: string;
  filterQuery?: ConditionalExpression;
  label?: string;
}

export interface IntegrationsFilters {
  category?: string;
  label?: string;
}

export type Filters = {
  components?: ComponentsFilters;
  integrations?: IntegrationsFilters;
  marketplace?: MarketplaceFilters;
};
