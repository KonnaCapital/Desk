import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AutostartController, type AutostartApi } from "./autostart.ts";

function fakeApi(
  initial: boolean,
  hooks: Partial<AutostartApi> = {},
): AutostartApi & { enabled: boolean } {
  const api = {
    enabled: initial,
    async isEnabled() {
      return api.enabled;
    },
    async enable() {
      api.enabled = true;
    },
    async disable() {
      api.enabled = false;
    },
    ...hooks,
  } as AutostartApi & { enabled: boolean };
  return api;
}

describe("AutostartController", () => {
  it("enables autostart and verifies the resulting OS state", async () => {
    const api = fakeApi(false);
    const controller = new AutostartController(api);

    assert.deepEqual(await controller.open(), {
      available: true,
      enabled: false,
      error: null,
    });
    assert.deepEqual(await controller.setEnabled(true), {
      enabled: true,
      error: null,
    });
    assert.equal(api.enabled, true);
  });

  it("rejects an OS-state verification mismatch and restores the visual state", async () => {
    const api = fakeApi(false, {
      async enable() {
        // The OS refuses to reflect the requested state.
      },
    });
    const controller = new AutostartController(api);

    await controller.open();
    assert.deepEqual(await controller.setEnabled(true), {
      enabled: false,
      error: "verification",
    });
    assert.equal(controller.enabled, false);
  });

  it("restores the visual state when the OS change fails", async () => {
    const api = fakeApi(true, {
      async disable() {
        throw new Error("permission denied");
      },
    });
    const controller = new AutostartController(api);

    await controller.open();
    assert.deepEqual(await controller.setEnabled(false), {
      enabled: true,
      error: "change",
    });
    assert.equal(controller.enabled, true);
  });
});
