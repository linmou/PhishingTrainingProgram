import { TransferAssessmentService, AssessmentApiRequestError } from '../transferAssessmentService';
import { getApplicationUserId, resetApplicationIdentityForTests, setApplicationUserId } from '../applicationIdentity';

afterEach(resetApplicationIdentityForTests);
it('resolves the current identity at request time for every transport', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { ok: true, result: {} }, error: null });
  const service = new TransferAssessmentService({ api: { invoke }, getApplicationUserId });
  setApplicationUserId('first');
  await service.analyzeMessage('message', 'room');
  expect(invoke).toHaveBeenLastCalledWith(expect.any(Object), 'first');
  setApplicationUserId('second');
  await service.analyzeMessage('message', 'room');
  expect(invoke).toHaveBeenLastCalledWith(expect.any(Object), 'second');
  setApplicationUserId(null);
  await expect(service.analyzeMessage('message', 'room')).rejects.toBeInstanceOf(AssessmentApiRequestError);
  expect(invoke).toHaveBeenCalledTimes(2);
});
