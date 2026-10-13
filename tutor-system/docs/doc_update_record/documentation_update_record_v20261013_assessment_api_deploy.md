# Assessment API deployment preparation — 2026-10-13

Intent: provide a dependency-complete Management API release command after the SQL and staging gates in `supabase-release-workflow.md` pass.

Run from `tutor-system/` with installed dependencies:

```sh
rtk proxy node scripts/deploy-assessment-api.js --dry-run ciubrzggdqesgvfkpolj
rtk proxy node scripts/deploy-assessment-api.js --bundle-only ciubrzggdqesgvfkpolj
```

The script recursively collects relative TypeScript imports, including imports outside the function directory in `src/`, and uploads each with its original relative path. The current source graph contains 13 files and one external HTTPS dependency. Future relative imports from shared function modules are followed by the same traversal. Dry-run prints paths and SHA-256 hashes without using credentials or making requests.

Bundle-only loads `SUPABASE_ACCESS_TOKEN` from the process environment or `.env`; an optional final argument selects another env file. It checks only the names of the three required provider secrets, uploads the source using `multipart/form-data`, and verifies the existing deployed function ID, version, and update timestamp did not change. Output contains source hashes and function metadata, never token or secret values.

After the required release gates pass, use the same script with `--deploy` and the explicit project ref. Staging is `ciubrzggdqesgvfkpolj`; production is `zgbufaxooqxeabewktzd`. The script uses `verify_jwt=false`, matching the application's existing offline identity verifier. It does not apply SQL or set secrets. Recheck the source hash before the production command to ensure both projects receive the same source.

The contract is documented in the official [Management API deploy reference](https://supabase.com/docs/reference/api/v1-deploy-a-function) and [bundle-only announcement](https://supabase.com/changelog/33720-deploy-and-update-edge-functions-using-the-management-api). The latter specifies that `bundleOnly=1` returns bundle metadata without updating the function.

Validation on 2026-10-13: dry-run and staging bundle-only both exited 0. Provider secret names were present. Source manifest hash was `92e098cc59a512e44a46fda572942aa25df3dfac45656a8078200a196779c965`; the API produced bundle hash `5ef5c7da82a8efeb8613974197a38d760ad3162fe183ebdb68a4f2d0d2ee62f0`. Staging function `1a47f58e-5451-422c-b9d3-26cba3b20faa` stayed at deployed version 50 with unchanged update timestamp `1791155347030`. No deployment was activated by this preparation.
