import {
  ConditionalExpression,
  BooleanOperator,
  TermOperator,
} from "./conditionalLogic";

export { BooleanOperator, TermOperator, ConditionalExpression };

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
  /**
   * @deprecated Use marketplace instead, this will be removed in the next major version (v3.0.0)
   */
  category?: string;
  /**
   * @deprecated Use marketplace instead, this will be removed in the next major version (v3.0.0)
   */
  filterQuery?: ConditionalExpression;
  /**
   * @deprecated Use marketplace instead, this will be removed in the next major version (v3.0.0)
   */
  label?: string;
  components?: ComponentsFilters;
  integrations?: IntegrationsFilters;
  marketplace?: MarketplaceFilters;
};
