import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  registerCloseHandler,
  type CloseRequestEvent,
  type CloseWindow,
} from "./close.ts";

describe("close protection", () => {
  it("does not wait forever when persistence never settles", async () => {
    let handler!: (event: CloseRequestEvent) => void | Promise<void>;
    let destroyCalls = 0;
    let problem: string | undefined;
    const registration = await registerCloseHandler(
      {
        async onCloseRequested(next) {
          handler = next;
          return () => {};
        },
        async destroy() {
          destroyCalls += 1;
        },
      },
      () => new Promise<void>(() => {}),
      (result) => {
        problem = result;
      },
      5,
    );
    assert.equal(registration.registered, true);

    await handler({ preventDefault() {} });
    assert.equal(problem, "timed-out");
    assert.equal(destroyCalls, 1);
  });

  it("awaits native close registration and flushes before destroying once", async () => {
    let handler: ((event: CloseRequestEvent) => void | Promise<void>) | undefined;
    let handlerRegistered = false;
    let flushCalls = 0;
    let destroyCalls = 0;
    let releaseFlush!: () => void;
    let releaseRegistration!: () => void;
    const flushReleased = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const registrationReleased = new Promise<void>((resolve) => {
      releaseRegistration = resolve;
    });
    const api: CloseWindow = {
      async onCloseRequested(next) {
        await registrationReleased;
        handler = next;
        handlerRegistered = true;
        return () => {};
      },
      async destroy() {
        destroyCalls += 1;
      },
    };

    let registrationSettled = false;
    const registrationPromise = registerCloseHandler(
      api,
      async () => {
        flushCalls += 1;
        await flushReleased;
      },
      () => {},
    );
    void registrationPromise.then(() => {
      registrationSettled = true;
    });
    await Promise.resolve();
    assert.equal(registrationSettled, false);
    assert.equal(handlerRegistered, false);
    releaseRegistration();
    const registration = await registrationPromise;
    assert.equal(registration.registered, true);
    assert.equal(handlerRegistered, true);

    let prevented = 0;
    const closePromise = handler!({
      preventDefault() {
        prevented += 1;
      },
    });
    await Promise.resolve();
    assert.equal(prevented, 1);
    assert.equal(flushCalls, 1);
    assert.equal(destroyCalls, 0);

    releaseFlush();
    await closePromise;
    assert.equal(destroyCalls, 1);
  });

  it("reports a native close registration failure", async () => {
    const registration = await registerCloseHandler(
      {
        async onCloseRequested() {
          throw new Error("native listener unavailable");
        },
        async destroy() {},
      },
      async () => {},
      () => {},
    );
    assert.equal(registration.registered, false);
  });
});
