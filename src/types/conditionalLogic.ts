export enum BooleanOperator {
  and = "and",
  or = "or",
}

export enum TermOperator {
  equal = "equal",
  notEqual = "notEqual",
  in = "in",
  notIn = "notIn",
  startsWith = "startsWith",
  doesNotStartWith = "doesNotStartWith",
  endsWith = "endsWith",
  doesNotEndWith = "doesNotEndWith",
}

export const TermOperatorPhrase = {
  [TermOperator.equal]: "equals",
  [TermOperator.notEqual]: "does not equal",
  [TermOperator.in]: "contained in",
  [TermOperator.notIn]: "not contained in",
  [TermOperator.startsWith]: "starts the string",
  [TermOperator.doesNotStartWith]: "does not start the string",
  [TermOperator.endsWith]: "ends the string",
  [TermOperator.doesNotEndWith]: "does not end the string",
};

export type TermExpression = [TermOperator, unknown, unknown?];

export type BooleanExpression = [
  BooleanOperator.and | BooleanOperator.or,
  ...ConditionalExpression[]
];

export type ConditionalExpression = TermExpression | BooleanExpression;
