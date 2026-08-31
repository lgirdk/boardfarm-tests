import type { TestAsset, TestFilter } from "@/lib/contracts";

/**
 * Available-tests seam. These are the real, runnable tests in the git repo —
 * the catalog you pick from to run or schedule. The backend produces this by
 * reading git (parsing test files + their @pytest.mark.env_req markers); the
 * frontend only displays it. Mock now → GET /api/tests later.
 */
export interface TestsClient {
  list(filter?: TestFilter): Promise<TestAsset[]>;
}
