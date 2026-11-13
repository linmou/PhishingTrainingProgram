import { OAI_MODEL as SERVICE_MODEL } from '../aiService';
import { OAI_MODEL } from '../aiModels';

describe('environment-configured AI model', () => {
  const original = process.env.REACT_APP_OAI_MODEL;
  const originalCanonical = process.env.OAI_MODEL;
  beforeEach(() => { delete process.env.OAI_MODEL; });
  afterEach(() => {
    if (originalCanonical === undefined) delete process.env.OAI_MODEL;
    else process.env.OAI_MODEL = originalCanonical;
    if (original === undefined) delete process.env.REACT_APP_OAI_MODEL;
    else process.env.REACT_APP_OAI_MODEL = original;
  });
  it('keeps the service export aligned', () => expect(SERVICE_MODEL).toBe(OAI_MODEL));
  it('uses an arbitrary configured model without a source change', () => {
    process.env.REACT_APP_OAI_MODEL = '  alternate-provider-model  ';
    jest.isolateModules(() => {
      const models = require('../aiModels');
      expect(models.OAI_MODEL).toBe('alternate-provider-model');
      expect(Object.keys(models.AI_MODELS)).toEqual(['alternate-provider-model']);
      expect(models.AI_MODELS[models.OAI_MODEL].name).toBe('alternate-provider-model');
    });
  });
  it('supports Node scripts using the canonical model variable', () => {
    delete process.env.REACT_APP_OAI_MODEL;
    process.env.OAI_MODEL = 'node-configured-model';
    jest.isolateModules(() => expect(require('../aiModels').OAI_MODEL).toBe('node-configured-model'));
  });
  it.each([undefined, '', '   '])('has no hard-coded fallback for %p', value => {
    if (value === undefined) delete process.env.REACT_APP_OAI_MODEL;
    else process.env.REACT_APP_OAI_MODEL = value;
    jest.isolateModules(() => {
      const models = require('../aiModels');
      expect(models.OAI_MODEL).toBe('');
      expect(models.AI_MODELS).toEqual({});
    });
  });
});
