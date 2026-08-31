import type { PastRunLog } from "@/lib/contracts";

/**
 * MOCK DATA for the log analyzer. Delete this file once the analyzer backend is
 * live — the HttpAnalyzerClient already targets the real endpoints. Nothing
 * outside MockAnalyzerClient should import from here.
 */
export const SAMPLE_LOG = [
  "02:31:02  provision   eRouter provisioned dual :: 172.25.1.114 / 2001:dead:beef:2::114",
  "02:31:03  boardfarm   Environment ready in 7m 07s",
  "02:31:04  softphone1  REGISTER sip:1000@10.64.38.19 -> sent",
  "02:31:34  softphone1  No response after 30000ms, giving up",
  "02:31:34  kamailio    auth: no matching AOR for 1000 in location table",
  "02:31:35  pytest      FAILED tests/voice/test_voice_call_fxs_to_fxs.py",
].join("\n");

export const PAST_RUN_LOGS: PastRunLog[] = [
  { id: "r-0145", what: "test_voice_rtp_codec_g711a", log: SAMPLE_LOG },
  {
    id: "r-0140",
    what: "nightly-sanity · test_tr069_periodic_inform",
    log: [
      "01:58:09  acs         Connection request delivered to CPE",
      "01:58:10  acs         Inform sent, awaiting response",
      "01:58:40  acs         timed out waiting for ACS response (30000ms)",
      "01:58:40  pytest      FAILED tests/tr069/test_tr069_periodic_inform.py",
    ].join("\n"),
  },
];
