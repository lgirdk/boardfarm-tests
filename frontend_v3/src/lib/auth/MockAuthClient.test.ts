import { beforeEach, describe, expect, it } from "vitest";
import { MockAuthClient } from "./MockAuthClient";

describe("MockAuthClient", () => {
  beforeEach(() => sessionStorage.clear());

  it("rejects empty credentials", async () => {
    const client = new MockAuthClient(0);
    await expect(client.login("", "x")).rejects.toThrow(/username and password/i);
    await expect(client.login("user", " ")).rejects.toThrow(/username and password/i);
  });

  it("accepts any non-empty credentials and mints a user", async () => {
    const client = new MockAuthClient(0);
    const user = await client.login("ahazra", "pw");
    expect(user.username).toBe("ahazra");
    expect(user.initials).toBe("AH");
    expect(user.workspace.id).toBe("docsis-team");
  });

  it("persists the session across me() and clears it on logout", async () => {
    const client = new MockAuthClient(0);
    await client.login("ahazra", "pw");
    expect((await client.me())?.username).toBe("ahazra");
    await client.logout();
    expect(await client.me()).toBeNull();
  });
});
