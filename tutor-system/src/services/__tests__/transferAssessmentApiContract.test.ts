// Test responsibility: freeze the six-operation API envelope and public/private DTO boundary.

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  ASSESSMENT_API_ERROR_STATUS,
  ASSESSMENT_API_OPERATIONS,
  ASSESSMENT_PRIVATE_FIELD_NAMES,
  PUBLIC_ASSESSMENT_DTO_KEYS,
  errorEnvelope,
  isAssessmentApiOperation,
  projectPublicPayload,
  successEnvelope,
} from '../../types/assessmentApi';
import { TransferAssessmentService, type ProcessedMessageDTO } from '../transferAssessmentService';

function configuredRpcForwardsResult(source: string): boolean {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const factory = file.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === 'createDefaultDependencies');
  const body = factory?.body;
  if (!body) return false;
  const guards = body.statements.filter(ts.isIfStatement);
  if (guards.length !== 1 || guards[0].elseStatement || !ts.isBlock(guards[0].thenStatement) ||
      guards[0].thenStatement.statements.length !== 1 ||
      !ts.isReturnStatement(guards[0].thenStatement.statements[0])) return false;
  const condition = guards[0].expression;
  const negates = (value: ts.Expression, name: string): boolean =>
    ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(value.operand) && value.operand.text === name;
  if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.BarBarToken ||
      !negates(condition.left, 'url') || !negates(condition.right, 'serviceKey')) return false;

  const returns: ts.ReturnStatement[] = [];
  const collectReturns = (node: ts.Node): void => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return;
    if (ts.isReturnStatement(node)) returns.push(node);
    ts.forEachChild(node, collectReturns);
  };
  body.statements.forEach(collectReturns);
  const lastStatement = body.statements[body.statements.length - 1];
  if (returns.length !== 2 || returns[0] !== guards[0].thenStatement.statements[0] ||
      returns[1] !== lastStatement) return false;
  if (!lastStatement || !ts.isReturnStatement(lastStatement) ||
      !lastStatement.expression || !ts.isObjectLiteralExpression(lastStatement.expression)) return false;
  let adminBinding: ts.VariableDeclaration | undefined;
  for (let index = 0; index < body.statements.length; index += 1) {
    const statement = body.statements[index];
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'admin') continue;
      if (adminBinding || index <= body.statements.indexOf(guards[0]) ||
          index >= body.statements.length - 1 ||
          !(statement.declarationList.flags & ts.NodeFlags.Const)) return false;
      adminBinding = declaration;
    }
  }
  if (!adminBinding?.initializer || !ts.isCallExpression(adminBinding.initializer)) return false;
  const clientCall = adminBinding.initializer;
  if (!ts.isIdentifier(clientCall.expression) || clientCall.expression.text !== 'createClient' ||
      clientCall.arguments.length < 2 ||
      !ts.isIdentifier(clientCall.arguments[0]) || clientCall.arguments[0].text !== 'url' ||
      !ts.isIdentifier(clientCall.arguments[1]) || clientCall.arguments[1].text !== 'serviceKey') return false;
  const rpc = lastStatement.expression.properties.find((property): property is ts.PropertyAssignment =>
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'rpc');
  if (!rpc || !ts.isArrowFunction(rpc.initializer) ||
      rpc.initializer.parameters.length !== 2 ||
      rpc.initializer.parameters[0].name.getText(file) !== 'name' ||
      rpc.initializer.parameters[1].name.getText(file) !== 'args' ||
      !ts.isBlock(rpc.initializer.body) || rpc.initializer.body.statements.length !== 2) return false;

  const [callStatement, returnStatement] = rpc.initializer.body.statements;
  if (!ts.isVariableStatement(callStatement) ||
      !(callStatement.declarationList.flags & ts.NodeFlags.Const) ||
      callStatement.declarationList.declarations.length !== 1 ||
      !ts.isReturnStatement(returnStatement) || !returnStatement.expression ||
      !ts.isObjectLiteralExpression(returnStatement.expression)) return false;
  const declaration = callStatement.declarationList.declarations[0];
  if (!ts.isIdentifier(declaration.name) || !declaration.initializer ||
      !ts.isAwaitExpression(declaration.initializer) ||
      !ts.isCallExpression(declaration.initializer.expression)) return false;
  const call = declaration.initializer.expression;
  if (!ts.isPropertyAccessExpression(call.expression) ||
      !ts.isIdentifier(call.expression.expression) ||
      call.expression.expression.text !== 'admin' || call.expression.name.text !== 'rpc' ||
      call.arguments.length !== 2 ||
      !ts.isIdentifier(call.arguments[0]) || call.arguments[0].text !== 'name' ||
      !ts.isIdentifier(call.arguments[1]) || call.arguments[1].text !== 'args') return false;

  const resultName = declaration.name.text;
  const fields = returnStatement.expression.properties;
  return fields.length === 2 && ['data', 'error'].every((field, index) => {
    const property = fields[index];
    return ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) &&
      property.name.text === field && ts.isPropertyAccessExpression(property.initializer) &&
      ts.isIdentifier(property.initializer.expression) &&
      property.initializer.expression.text === resultName &&
      property.initializer.name.text === field;
  });
}

describe('assessment API contract', () => {
  it('configured default RPC adapter awaits and returns admin RPC result', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/assessment-api/index.ts'), 'utf8'
    );
    const fixture = (adapterBody: string, alternateReturn = '', adminSource = 'createClient(url, serviceKey)') =>
      `function createDefaultDependencies() {
      const env = (name) => undefined;
      const url = 'url';
      const serviceKey = 'key';
      if (!url || !serviceKey) { return { featureEnabled: false }; }
      ${alternateReturn}
      const admin = ${adminSource};
      return { rpc: async (name, args) => { ${adapterBody} }, env };
    }`;
    const forwards = 'const result = await admin.rpc(name, args); return { data: result.data, error: result.error };';
    expect(configuredRpcForwardsResult(fixture(forwards))).toBe(true);
    expect(configuredRpcForwardsResult(fixture(`// ${forwards}\nreturn { data: null, error: null };`))).toBe(false);
    expect(configuredRpcForwardsResult(fixture(forwards,
      "if (env('RPC_NOOP')) return { rpc: async () => ({ data: null, error: null }) };"))).toBe(false);
    expect(configuredRpcForwardsResult(fixture(forwards, '',
      "env('RPC_NOOP') ? { rpc: async () => ({ data: null, error: null }) } : createClient(url, serviceKey)"))).toBe(false);
    expect(configuredRpcForwardsResult(source)).toBe(true);
  });

  it('keeps exactly six stable operations and versioned envelopes', () => {
    expect(ASSESSMENT_API_OPERATIONS).toEqual([
      'initialize_checklist', 'post_message', 'analyze_message',
      'prepare_turn', 'send_reviewed', 'process_message',
    ]);
    expect(new Set(ASSESSMENT_API_OPERATIONS).size).toBe(6);
    ASSESSMENT_API_OPERATIONS.forEach((operation) => expect(isAssessmentApiOperation(operation)).toBe(true));
    expect(isAssessmentApiOperation('grade_locally')).toBe(false);
    expect(successEnvelope({ id: 'x' })).toEqual({ ok: true, data: { id: 'x' } });
    expect(errorEnvelope('INVALID_SCOPE', 'scope mismatch')).toEqual({
      ok: false,
      error: { code: 'INVALID_SCOPE', message: 'scope mismatch', retryable: false },
    });
  });

  it('defines all stable failure classes', () => {
    for (const code of [
      'AUTHORIZATION_NOT_CONFIGURED', 'UNAUTHORIZED', 'FORBIDDEN',
      'ASSESSMENT_FEATURE_DISABLED', 'LEGACY_CHECKLIST', 'LEGACY_ASSESSMENT_INCOMPLETE',
      'UNSUPPORTED_ROOM_SCOPE', 'ASSESSMENT_ALREADY_OPEN', 'ASSESSMENT_TERMINAL',
      'INVALID_SCOPE', 'WRONG_LEARNER', 'ITEM_VALIDATION_FAILED',
      'AI_PROVIDER_NOT_CONFIGURED', 'AI_PROVIDER_ERROR', 'AI_OUTPUT_TRUNCATED',
      'AI_OUTPUT_INVALID', 'PROGRESSION_LOCKED', 'PERSISTENCE_FAILED',
    ]) expect(ASSESSMENT_API_ERROR_STATUS[code]).toBeDefined();
  });

  it('projects an assessment to exactly id, student_id, selection_type, stem, and options', () => {
    const result = TransferAssessmentService.toPublicAssessment({
      id: 'assessment-1',
      student_id: 'learner-1',
      selection_type: 'single',
      stem: 'Which action is safest?',
      rendered_text: 'private duplicate rendering',
      options: [
        { id: 'A', text: 'Open it' },
        { id: 'B', text: 'Verify elsewhere' },
        { id: 'C', text: 'Forward it' },
        { id: 'D', text: 'Reply' },
      ],
      correct_option_ids: ['B'],
      learner_safe_explanation: 'Verify through a known channel.',
      transfer_basis: { concept_rule: 'verify', source_context: 'x', changed_context: 'y', source_evidence_message_ids: ['m1'] },
    });

    expect(Object.keys(result)).toEqual(PUBLIC_ASSESSMENT_DTO_KEYS);
    expect(result.student_id).toBe('learner-1');
    expect(JSON.stringify(result)).not.toContain('rendered_text');
    expect(JSON.stringify(result)).not.toContain('learner_safe_explanation');
  });

  it('rejects a missing target instead of inferring learner identity', () => {
    expect(() => TransferAssessmentService.toPublicAssessment({
      id: 'assessment-1', selection_type: 'single', stem: 'Question',
      options: [{ id: 'A', text: 'One' }],
    })).toThrow('INVALID_SCOPE');
  });

  it('prunes rendered and private fields recursively from generic public payloads', () => {
    const projected = projectPublicPayload({
      safe: true,
      rendered_text: 'forbidden',
      nested: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'private except terminal failure',
        raw_provider_output: 'private',
      },
    });
    expect(projected).toEqual({ safe: true, nested: {} });
    expect(ASSESSMENT_PRIVATE_FIELD_NAMES).toEqual(expect.arrayContaining([
      'rendered_text', 'correct_option_ids', 'learner_safe_explanation', 'raw_provider_output',
    ]));
  });

  it('keeps the canonical processed-message DTO field set unchanged', () => {
    const dto: ProcessedMessageDTO = {
      message_id: 'answer-1',
      assessment_id: 'assessment-1',
      processing_state: 'applied',
      answer_outcome: 'failed',
      attempt_number: 2,
      attempts_used: 2,
      attempts_remaining: 0,
      selected_option_ids: ['A'],
      terminal: true,
      transition: { disposition: 'applied' },
      feedback_required: true,
      code: null,
      already_processed: false,
      terminal_failure_feedback: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'Verify via the official channel.',
      },
    };
    expect(Object.keys(dto)).toEqual([
      'message_id', 'assessment_id', 'processing_state', 'answer_outcome', 'attempt_number',
      'attempts_used', 'attempts_remaining', 'selected_option_ids', 'terminal', 'transition',
      'feedback_required', 'code', 'already_processed', 'terminal_failure_feedback',
    ]);
  });

  it('keeps production grading and provider configuration in the trusted handler', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/assessment-api/index.ts'),
      'utf8'
    );
    expect(source).toContain("resolveTransferAnswer } from '../../../src/services/transferAssessmentOrchestrator.ts'");
    expect(source).toContain("deps.env('OAI_API_KEY')");
    expect(source).toContain("deps.env('OAI_BASE_URL')");
    expect(source).toContain("deps.env('OAI_MODEL')");
    expect(source).toContain("const PROVIDER_MODEL = 'qwen3.5-flash'");
    expect(source).toContain('p_expected_attempt_count');
    expect(source).toContain("committed.code === 'CONCURRENT_MODIFICATION'");
    expect(source).not.toContain('REACT_APP_OAI');
  });
});
