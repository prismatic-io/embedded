import {
  ConditionalExpression,
  BooleanOperator,
  BinaryOperator,
} from "@prismatic-io/spectral";

const {
  dateTimeAfter,
  dateTimeBefore,
  dateTimeSame,
  doesNotExactlyMatch,
  exactlyMatches,
  greaterThan,
  greaterThanOrEqual,
  lessThan,
  lessThanOrEqual,
  ...TermOperator
} = BinaryOperator;

export { BooleanOperator, TermOperator, ConditionalExpression };

export interface MarketplaceFilters {
  category?: string;
  filterQuery?: ConditionalExpression;
  includeActiveIntegrations?: boolean;
  label?: string;
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
   * @deprecated Use marketplace instead, this will be removed in the next major version (v2.0.0)
   */
  category?: string;
  /**
   * @deprecated Use marketplace instead, this will be removed in the next major version (v2.0.0)
   */
  filterQuery?: ConditionalExpression;
  /**
   * @deprecated Use marketplace instead, this will be removed in the next major version (v2.0.0)
   */
  label?: string;
  components?: ComponentsFilters;
  integrations?: IntegrationsFilters;
  marketplace?: MarketplaceFilters;
};
