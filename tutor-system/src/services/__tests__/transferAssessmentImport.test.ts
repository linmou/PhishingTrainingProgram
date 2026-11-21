/** Importing the facade must not construct a Supabase client. */
it('imports without frontend database configuration', () => {
  const priorUrl = process.env.REACT_APP_SUPABASE_URL;
  const priorKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  delete process.env.REACT_APP_SUPABASE_URL;
  delete process.env.REACT_APP_SUPABASE_ANON_KEY;
  try {
    jest.isolateModules(() => {
      expect(() => require('../transferAssessmentService')).not.toThrow();
    });
  } finally {
    if (priorUrl === undefined) delete process.env.REACT_APP_SUPABASE_URL;
    else process.env.REACT_APP_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    else process.env.REACT_APP_SUPABASE_ANON_KEY = priorKey;
  }
});
