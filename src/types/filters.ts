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

export type Filters = {
  category?: string;
  filterQuery?: ConditionalExpression;
  label?: string;
};
