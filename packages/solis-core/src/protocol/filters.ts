/** Conditional-expression shape accepted by marketplace `filterQuery`. */

export type BooleanOperator = "and" | "or";

export type TermOperator =
  | "equal"
  | "notEqual"
  | "in"
  | "notIn"
  | "startsWith"
  | "doesNotStartWith"
  | "endsWith"
  | "doesNotEndWith";

/** Operator, field, and an operand omitted by the unary forms. */
export type TermExpression = [TermOperator, unknown, unknown?];

export type BooleanExpression = [BooleanOperator, ...ConditionalExpression[]];

export type ConditionalExpression = TermExpression | BooleanExpression;
